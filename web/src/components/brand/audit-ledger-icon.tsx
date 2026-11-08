import * as React from "react";

export function AuditLedgerIcon({
  className = "h-4 w-4",
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id="ali-grad"
          x1="3"
          y1="3"
          x2="21"
          y2="21"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#00EC97" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>

      {/* Ledger Page / Block Container */}
      <rect
        x="4"
        y="3"
        width="16"
        height="18"
        rx="3"
        fill="#041209"
        fillOpacity="0.8"
        stroke="url(#ali-grad)"
        strokeWidth="1.75"
      />

      {/* Block Hash Link Lines */}
      <line
        x1="8"
        y1="8"
        x2="16"
        y2="8"
        stroke="#00EC97"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="8"
        y1="12"
        x2="16"
        y2="12"
        stroke="#00EC97"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.7"
      />
      <line
        x1="8"
        y1="16"
        x2="13"
        y2="16"
        stroke="#00EC97"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.45"
      />

      {/* Tamper-Proof Cryptographic Dot */}
      <circle cx="16" cy="16" r="1.2" fill="#00EC97" />
    </svg>
  );
}
