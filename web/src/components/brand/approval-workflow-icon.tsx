import * as React from "react";

export function ApprovalWorkflowIcon({
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
          id="awi-grad"
          x1="2"
          y1="2"
          x2="22"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#00EC97" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
      </defs>

      {/* Multi-Signature Outer Ring */}
      <circle
        cx="12"
        cy="12"
        r="9.5"
        stroke="url(#awi-grad)"
        strokeWidth="1.75"
        strokeDasharray="5 2"
      />

      {/* Consensus Verification Key / Check */}
      <path
        d="M8 12.5L10.5 15L16 9.5"
        stroke="#00EC97"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dual Key Signer Nodes */}
      <circle cx="12" cy="2.5" r="1.5" fill="#00EC97" />
      <circle cx="12" cy="21.5" r="1.5" fill="#00EC97" />
    </svg>
  );
}
