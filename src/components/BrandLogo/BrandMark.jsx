import { useId } from 'react'

const BrandMark = ({ className = 'h-10 w-10', title = 'DocuMentor' }) => {
  const gradientId = useId()
  const softGradientId = useId()

  return (
    <svg
      className={className}
      viewBox="0 0 128 128"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradientId} x1="18" y1="98" x2="108" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--doc-logo-start, #7c3aed)" />
          <stop offset="0.58" stopColor="var(--doc-logo-mid, #5b21b6)" />
          <stop offset="1" stopColor="var(--doc-logo-end, #9333ea)" />
        </linearGradient>
        <linearGradient id={softGradientId} x1="36" y1="82" x2="96" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--doc-logo-start, #7c3aed)" stopOpacity="0.72" />
          <stop offset="1" stopColor="var(--doc-logo-end, #38bdf8)" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      <path
        d="M27.5 75.8C21.8 77.4 16 75 12.9 70.3C7.8 62.4 11.1 49 21.1 36.8C33.2 22 53.3 14.9 74.6 17.5C98.2 20.4 114.2 34.9 116.8 55.7C119.4 76.6 108.4 91 90.2 101.1C80.6 106.4 75.2 111.7 72.8 119"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="drop-shadow(0 10px 18px var(--doc-logo-shadow, rgba(124, 58, 237, 0.24)))"
      />

      <path
        d="M25.2 72.4C31.6 70.1 33.1 83.7 42.8 84.4C53.6 85.3 54.1 69.9 60 69.9C65.2 69.9 63.3 85.8 76.2 86.1C87.9 86.3 88.7 77.2 93.7 77.5C98.1 77.7 97.4 87.3 107.4 85.8C113.6 84.9 112.4 78 116.4 77.1"
        fill="none"
        stroke={`url(#${softGradientId})`}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M46.5 42.5C52.4 39.6 55.2 36.8 57.8 30.5C60.6 36.8 63.4 39.6 69.5 42.5C63.4 45.4 60.6 48.2 57.8 54.5C55.2 48.2 52.4 45.4 46.5 42.5Z"
        fill="var(--doc-logo-spark, #a78bfa)"
        opacity="0.96"
      />
    </svg>
  )
}

export default BrandMark
