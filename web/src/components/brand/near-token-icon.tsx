import * as React from "react";

export function NearTokenIcon({
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
          id="nti-grad"
          x1="2"
          y1="2"
          x2="22"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#00EC97" />
          <stop offset="100%" stopColor="#00B377" />
        </linearGradient>
      </defs>

      {/* Outer Hex Token Badge */}
      <polygon
        points="12,2 21,7.2 21,16.8 12,22 3,16.8 3,7.2"
        fill="#05140B"
        stroke="url(#nti-grad)"
        strokeWidth="1.5"
      />

      {/* NEAR Protocol Stylized "N" Monogram */}
      <path
        d="M7.5 16.5V7.5L14 16.5H16.5V7.5"
        stroke="#00EC97"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
