import * as React from "react";

export function PolicyShieldIcon({
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
          id="psi-grad"
          x1="3"
          y1="2"
          x2="21"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#00EC97" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>

      {/* Security Shield Contour */}
      <path
        d="M12 2L4 5.5V11.5C4 16.5 7.5 20.8 12 22C16.5 20.8 20 16.5 20 11.5V5.5L12 2Z"
        fill="#041209"
        fillOpacity="0.8"
        stroke="url(#psi-grad)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      {/* Cryptographic Circuit Checkmark */}
      <path
        d="M8.5 11.5L11 14L16 9"
        stroke="#00EC97"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Internal Security Anchor */}
      <circle cx="12" cy="18" r="1.2" fill="#00EC97" />
    </svg>
  );
}
