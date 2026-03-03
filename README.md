# Documentor - AI-Powered Research Paper Formatter

An intelligent document formatting assistant that uses AI to format research papers in standard academic formats (APA, MLA, IEEE, etc.).

## 🚀 Features

### Current Implementation (Phase 1)
- ✅ **Modern Authentication System**
  - Login, Signup, and Password Recovery pages
  - Social authentication (Google, Facebook, Apple)
  - Secure session management with Zustand

- ✅ **Subscription & Billing**
  - Three-tier pricing (Free, Premium, Team)
  - Monthly and Annual billing options
  - QuillBot-inspired pricing interface

- ✅ **Dashboard Interface**
  - User-friendly dashboard with statistics
  - Document history tracking
  - Project management
  - Quick actions for common tasks

### Planned Modules

#### Module 1: Smart Document Ingestion
- Upload support for .docx, .pdf, and .txt files
- NLP-based segmentation into sections
- Detect tables, figures, citations, and captions
- Pre-process documents to remove noise

#### Module 2: AI-Driven Formatting Engine
- Select from formatting presets (APA, MLA, IEEE, journal-specific)
- Automatically apply layout rules
- Real-time document reflow and restiling
- Enforce consistency throughout the document

#### Module 3: Citation & Reference Assistant
- Detect and validate in-text citations
- Auto-generate reference lists
- Format citations in multiple styles
- Integration with CrossRef, Zotero, or Mendeley APIs

#### Module 4: Grammar & Language Quality Enhancer
- AI-powered grammar correction
- Academic tone and clarity suggestions
- Sentence restructuring for fluency
- Passive voice and redundancy detection

#### Module 5: Plagiarism Detection Module
- Scan against academic databases
- Highlight plagiarized content
- AI-assisted rephrasing suggestions
- Similarity reports and originality scores

#### Module 6: Real-Time Preview & Editor
- Live preview of formatted document
- Toggle between raw input and styled output
- Inline highlighting of issues
- Quick style switching

#### Module 7: Export & Submission Package Generator
- Export to .docx, .pdf, and .LaTeX formats
- Generate metadata files
- Journal-specific submission checklists
- Bundle documents with logs and references

#### Module 8: User-Friendly Research Dashboard
- Document history and version tracking
- Project grouping by subject/thesis/journal
- Progress status tracking
- Notifications and reminders

#### Module 9: Admin Panel & Style Guide Manager
- Upload/edit style templates
- Validate formatting rules
- System logs and performance metrics
- Role-based access controls

## 🛠️ Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Routing**: React Router v6
- **Icons**: React Icons
- **HTTP Client**: Axios

## 📦 Quick Start

### Easy Start (Recommended)
```powershell
.\start.ps1
```
This starts both frontend and backend in separate windows.

### Manual Setup

**Frontend:**
```powershell
npm install
npm run dev
```

**Backend:**
```powershell
cd backend
npm install
npm run dev
```

See [QUICKSTART.md](QUICKSTART.md) for detailed setup or [SETUP.md](SETUP.md) for complete instructions.

## 🌐 Access Points

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000
- **API Health Check:** http://localhost:5000/api/health

## 📁 Project Structure

```
Documentor/
├── src/
│   ├── pages/
│   │   ├── Auth/
│   │   │   ├── Login.jsx
│   │   │   ├── Signup.jsx
│   │   │   └── ForgotPassword.jsx
│   │   ├── Pricing/
│   │   │   └── Pricing.jsx
│   │   └── Dashboard/
│   │       └── Dashboard.jsx
│   ├── store/
│   │   └── authStore.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## 🎨 Design Philosophy

The interface is inspired by QuillBot's clean and intuitive design:
- **Minimalist UI**: Focus on functionality without clutter
- **Smooth Transitions**: Polished animations and hover effects
- **Clear Hierarchy**: Well-organized information architecture
- **Responsive Design**: Works seamlessly across all devices
- **Accessibility**: Built with accessibility best practices

## 🔐 Authentication Flow

1. User signs up or logs in
2. Redirected to pricing page to select a plan
3. Access dashboard with plan-specific features
4. Persistent authentication via localStorage

## 💳 Subscription Plans

### Free Plan
- 5 documents per month
- Basic formatting (APA, MLA)
- Grammar checking
- PDF export

### Premium Plan - $19.99/month
- Unlimited documents
- All formatting styles
- Advanced grammar & tone suggestions
- Citation assistant
- Plagiarism detection (10 checks/month)
- Export to PDF, DOCX, LaTeX

### Team Plan - $49.99/month
- Everything in Premium
- Up to 10 team members
- Unlimited plagiarism checks
- Custom style templates
- Team collaboration
- Admin dashboard
- API access
- Priority 24/7 support

## 🚧 Development Roadmap

### Phase 1: Foundation (Current)
- ✅ Project setup
- ✅ Authentication system
- ✅ Pricing/billing interface
- ✅ Basic dashboard

### Phase 2: Core Features
- [ ] Document upload system
- [ ] AI formatting engine
- [ ] Citation assistant
- [ ] Real-time preview

### Phase 3: Advanced Features
- [ ] Grammar & language enhancer
- [ ] Plagiarism detection
- [ ] Export functionality
- [ ] Project management

### Phase 4: Enterprise Features
- [ ] Team collaboration
- [ ] Admin panel
- [ ] Style guide manager
- [ ] API access

## 🤝 Contributing

This is a private project. For questions or suggestions, please contact the development team.

## 📄 License

Proprietary - All rights reserved

## 📧 Contact

For support or inquiries, please reach out to the Documentor team.

---

**Built with ❤️ for researchers and academics worldwide**
