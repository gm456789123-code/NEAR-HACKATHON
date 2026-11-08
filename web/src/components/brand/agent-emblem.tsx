import * as React from "react";

export function AgentEmblem({
  className = "h-5 w-5",
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient
          id="ae-grad"
          x1="4"
          y1="4"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#00EC97" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>

      {/* Outer Orbit Ring */}
      <circle
        cx="16"
        cy="16"
        r="13"
        stroke="#00EC97"
        strokeWidth="1.5"
        strokeDasharray="4 2.5"
        strokeOpacity="0.6"
      />

      {/* Inner Synchronized Matrix Shield */}
      <rect
        x="8"
        y="8"
        width="16"
        height="16"
        rx="4"
        fill="#05140B"
        stroke="url(#ae-grad)"
        strokeWidth="1.75"
      />

      {/* Agent Neural Core */}
      <circle cx="16" cy="16" r="3" fill="#00EC97" />
      <circle cx="12" cy="13" r="1.2" fill="#00EC97" />
      <circle cx="20" cy="13" r="1.2" fill="#00EC97" />

      {/* Status Communication Antennas */}
      <path
        d="M16 8V5M16 27V24M8 16H5M27 16H24"
        stroke="#00EC97"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
