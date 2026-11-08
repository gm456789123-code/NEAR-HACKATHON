import * as React from "react";

export function TreasuryMeshLogo({
  className = "h-6 w-6",
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id="tm-logo-primary"
          x1="6"
          y1="6"
          x2="42"
          y2="42"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#00EC97" />
          <stop offset="50%" stopColor="#00D688" />
          <stop offset="100%" stopColor="#0A8F5C" />
        </linearGradient>
        <linearGradient
          id="tm-logo-glow"
          x1="24"
          y1="8"
          x2="24"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#00EC97" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#00EC97" stopOpacity="0.02" />
        </linearGradient>
        <filter id="tm-neon-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Hexagonal Mesh Shield Outer Perimeter */}
      <polygon
        points="24,4 42,14 42,34 24,44 6,34 6,14"
        fill="url(#tm-logo-glow)"
        stroke="url(#tm-logo-primary)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Internal Cryptographic Circuit Mesh */}
      <path
        d="M24 4V18M42 14L30 21M42 34L30 27M24 44V30M6 34L18 27M6 14L18 21"
        stroke="#00EC97"
        strokeWidth="1.5"
        strokeOpacity="0.45"
        strokeLinecap="round"
      />

      {/* Inner Coordinated Geometric Core */}
      <polygon
        points="24,18 30,21 30,27 24,30 18,27 18,21"
        fill="#05140B"
        stroke="url(#tm-logo-primary)"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Center Autonomous Node */}
      <circle cx="24" cy="24" r="3.2" fill="#00EC97" filter="url(#tm-neon-glow)" />

      {/* Perimeter Verification Nodes */}
      <circle cx="24" cy="4" r="1.8" fill="#00EC97" />
      <circle cx="42" cy="14" r="1.8" fill="#00EC97" />
      <circle cx="42" cy="34" r="1.8" fill="#00EC97" />
      <circle cx="24" cy="44" r="1.8" fill="#00EC97" />
      <circle cx="6" cy="34" r="1.8" fill="#00EC97" />
      <circle cx="6" cy="14" r="1.8" fill="#00EC97" />
    </svg>
  );
}
