import fs from "fs";
import vm from "vm";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const [planPath, snippetsPath, outputPath] = process.argv.slice(2);

if (!planPath || !snippetsPath || !outputPath) {
  console.error("Usage: node build_docx.mjs <layout_plan.json> <section_snippets.json> <output.docx>");
  process.exit(1);
}

const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
const snippets = JSON.parse(fs.readFileSync(snippetsPath, "utf8"));

function inchesToTwips(value, fallback = 1) {
  const parsed = Number(value);
  return Math.round((Number.isFinite(parsed) ? parsed : fallback) * 1440);
}

function pageSizeForPlan(pageSize) {
  const normalized = String(pageSize || "letter").toLowerCase();
  if (normalized === "a4") {
    return { width: 11906, height: 16838 };
  }
  return { width: 12240, height: 15840 };
}

function sourcePreservationEnabled() {
  return plan.preserve_source_format !== false;
}

function alignmentFromSource(value, fallback = AlignmentType.LEFT) {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("center")) return AlignmentType.CENTER;
  if (normalized.includes("right")) return AlignmentType.RIGHT;
  if (normalized.includes("justify") || normalized.includes("justified")) return AlignmentType.JUSTIFIED;
  if (normalized.includes("both")) return AlignmentType.JUSTIFIED;
  return fallback;
}

function bodyAlignmentForItem(item) {
  if (plan.body_alignment) {
    return alignmentFromSource(plan.body_alignment, AlignmentType.LEFT);
  }
  if (Number(plan.columns || 1) > 1) {
    return AlignmentType.JUSTIFIED;
  }
  if (sourcePreservationEnabled() && item.sourceFormat?.alignment) {
    return alignmentFromSource(item.sourceFormat.alignment, AlignmentType.LEFT);
  }
  return AlignmentType.LEFT;
}

function lineSpacingTwips() {
  const value = Number(plan.line_spacing || 1.15);
  return Math.round(240 * (Number.isFinite(value) ? value : 1.15));
}

function paragraphSpacingAfter() {
  const value = Number(plan.paragraph_spacing_after_twips);
  return Number.isFinite(value) ? value : 120;
}

function paragraphIndentForItem(item) {
  const indent = {};
  const targetFirstLine = Number(plan.first_line_indent_inches || 0);
  if (Number.isFinite(targetFirstLine) && targetFirstLine !== 0) {
    indent.firstLine = inchesToTwips(targetFirstLine, 0);
  }

  if (sourcePreservationEnabled() && item.sourceFormat?.source === "docx" && Number.isFinite(Number(item.sourceFormat.left_indent_inches))) {
    indent.left = inchesToTwips(item.sourceFormat.left_indent_inches, 0);
  }

  return Object.keys(indent).length > 0 ? indent : undefined;
}

function sectionPropertiesForPlan(plan) {
  const margin = inchesToTwips(plan.margin_inches, 1);
  const pageSize = pageSizeForPlan(plan.page_size);
  const columnCount = Math.max(1, Number(plan.columns || 1));
  const properties = {
    page: {
      size: pageSize,
      margin: {
        top: margin,
        right: margin,
        bottom: margin,
        left: margin,
        header: 720,
        footer: 720,
        gutter: 0,
      },
    },
  };

  if (columnCount > 1) {
    properties.column = {
      count: columnCount,
      space: inchesToTwips(plan.column_gap_inches, 0.25),
      equalWidth: true,
    };
  }

  return properties;
}

function evaluateSnippet(snippet) {
  const context = {
    fs,
    AlignmentType,
    HeadingLevel,
    ImageRun,
    LevelFormat,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    WidthType,
  };

  const value = vm.runInNewContext(snippet, context, { timeout: 1000 });
  if (!Array.isArray(value)) {
    throw new Error("Section snippet did not evaluate to an array.");
  }
  return value.flatMap((item) => convertStructuredItem(item));
}

function convertStructuredItem(item) {
  if (item instanceof Paragraph || item instanceof Table) {
    return [item];
  }

  if (!item || typeof item !== "object") {
    return [];
  }

  if (item.type === "heading") {
    const level = Number(item.level || 1);
    return [
      new Paragraph({
        heading: headingStyleForLevel(level),
        alignment: item.align || AlignmentType.LEFT,
        spacing: { before: level <= 1 ? 240 : 160, after: level <= 1 ? 120 : 80 },
        children: [
          new TextRun({
            text: item.title || "",
            bold: true,
            smallCaps: Boolean(item.smallCaps),
            italics: level > 1 && String((plan.section_rules || {}).subsection_style || "").includes("italic"),
            font: item.font || plan.font,
            size: Math.round((item.size || plan.body_size_pt + 2) * 2),
          }),
        ],
      }),
    ];
  }

  if (item.type === "paragraph") {
    const sourceFormat = sourcePreservationEnabled() ? item.sourceFormat || {} : {};
    return [
      new Paragraph({
        alignment: bodyAlignmentForItem(item),
        spacing: { after: paragraphSpacingAfter(), line: lineSpacingTwips(), lineRule: "auto" },
        indent: paragraphIndentForItem(item),
        children: [
          new TextRun({
            text: item.text || "",
            bold: Boolean(sourceFormat.bold),
            italics: Boolean(sourceFormat.italic),
            font: item.font || plan.font,
            size: Math.round((item.size || plan.body_size_pt) * 2),
          }),
        ],
      }),
    ];
  }

  if (item.type === "list") {
    const sourceFormat = sourcePreservationEnabled() ? item.sourceFormat || {} : {};
    const items = Array.isArray(item.items) ? item.items : [];
    return items.map((text, index) =>
      new Paragraph({
        alignment: bodyAlignmentForItem(item),
        spacing: { after: paragraphSpacingAfter(), line: lineSpacingTwips(), lineRule: "auto" },
        indent: { left: 720, hanging: 360 },
        bullet: item.ordered ? undefined : { level: 0 },
        children: [
          new TextRun({
            text: item.ordered ? `${index + 1}. ${String(text || "")}` : String(text || ""),
            bold: Boolean(sourceFormat.bold),
            italics: Boolean(sourceFormat.italic),
            font: item.font || plan.font,
            size: Math.round((item.size || plan.body_size_pt) * 2),
          }),
        ],
      }),
    );
  }

  if (item.type === "figure") {
    const blocks = [];
    if (item.imagePath && fs.existsSync(item.imagePath)) {
      blocks.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 80 },
          children: [
            new ImageRun({
              data: fs.readFileSync(item.imagePath),
              transformation: { width: 420, height: 240 },
            }),
          ],
        }),
      );
    }
    if (item.caption) {
      blocks.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 160 },
          children: [
            new TextRun({
              text: item.caption,
              italics: true,
              font: plan.font,
              size: Math.round(plan.body_size_pt * 2),
            }),
          ],
        }),
      );
    }
    return blocks;
  }

  if (item.type === "table") {
    const rows = Array.isArray(item.rows) ? item.rows : [];
    const columnCount = rows[0]?.length || 1;
    const columnWidth = Math.floor(9000 / columnCount);
    return [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        columnWidths: Array.from({ length: columnCount }, () => columnWidth),
        rows: rows.map((row, rowIndex) =>
          new TableRow({
            children: row.map((cell) =>
              new TableCell({
                width: { size: columnWidth, type: WidthType.DXA },
                shading: rowIndex === 0 ? { type: ShadingType.CLEAR, fill: "EDEDED" } : undefined,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                      new TextRun({
                        text: String(cell ?? ""),
                        bold: rowIndex === 0,
                        font: plan.font,
                        size: Math.round(plan.body_size_pt * 2),
                      }),
                    ],
                  }),
                ],
              }),
            ),
          }),
        ),
      }),
      ...(item.caption
        ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 160 },
              children: [
                new TextRun({
                  text: item.caption,
                  italics: true,
                  font: plan.font,
                  size: Math.round(plan.body_size_pt * 2),
                }),
              ],
            }),
          ]
        : []),
    ];
  }

  return [];
}

function headingStyleForLevel(level) {
  if (level <= 1) return HeadingLevel.HEADING_1;
  if (level === 2) return HeadingLevel.HEADING_2;
  if (level === 3) return HeadingLevel.HEADING_3;
  return HeadingLevel.HEADING_4;
}

const children = [];

if (plan.metadata?.title) {
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: plan.metadata.title,
          bold: true,
          font: plan.font,
          size: Math.round((plan.body_size_pt + 6) * 2),
        }),
      ],
    }),
  );
}

if (Array.isArray(plan.metadata?.authors) && plan.metadata.authors.length > 0) {
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: plan.metadata.authors.join(", "),
          font: plan.font,
          size: Math.round(plan.body_size_pt * 2),
        }),
      ],
    }),
  );
}

if (plan.metadata?.affiliation) {
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: plan.metadata.affiliation,
          italics: true,
          font: plan.font,
          size: Math.round(plan.body_size_pt * 2),
        }),
      ],
    }),
  );
}

if (plan.metadata?.abstract) {
  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 160, after: 60 },
      children: [
        new TextRun({
          text: "Abstract",
          bold: true,
          font: plan.font,
          size: Math.round(plan.abstract_size_pt * 2),
        }),
      ],
    }),
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: paragraphSpacingAfter(), line: lineSpacingTwips(), lineRule: "auto" },
      children: [
        new TextRun({
          text: plan.metadata.abstract,
          font: plan.font,
          size: Math.round(plan.abstract_size_pt * 2),
        }),
      ],
    }),
  );
}

for (const section of plan.sections || []) {
  for (const subsection of section.subsections || []) {
    const snippet = snippets[subsection.id];
    if (!snippet) {
      continue;
    }
    children.push(...evaluateSnippet(snippet));
  }
}

if (Array.isArray(plan.references) && plan.references.length > 0) {
  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 200, after: 80 },
      children: [
        new TextRun({
          text: "References",
          bold: true,
          font: plan.font,
          size: Math.round((plan.body_size_pt + 2) * 2),
        }),
      ],
    }),
  );

  for (const reference of plan.references) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: paragraphSpacingAfter(), line: lineSpacingTwips(), lineRule: "auto" },
        indent: {
          left: inchesToTwips(plan.reference_hanging_indent_inches, 0.5),
          hanging: inchesToTwips(plan.reference_hanging_indent_inches, 0.5),
        },
        children: [
          new TextRun({
            text: reference.formatted || "",
            font: plan.font,
            size: Math.round(plan.body_size_pt * 2),
          }),
        ],
      }),
    );
  }
}

const doc = new Document({
  creator: "DocuMentor",
  title: plan.metadata?.title || "DocuMentor Export",
  sections: [
    {
      properties: sectionPropertiesForPlan(plan),
      children,
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outputPath, buffer);
