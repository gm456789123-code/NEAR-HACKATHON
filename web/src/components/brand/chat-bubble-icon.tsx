import * as React from "react";

export function ChatBubbleIcon({
  className = "h-4.5 w-4.5",
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
      <path
        d="M21 11.5C21 16.1944 16.9706 20 12 20C10.4284 20 8.95156 19.6177 7.68361 18.9482L3 20L4.25686 16.2294C3.46824 14.8517 3 13.2323 3 11.5C3 6.80558 7.02944 3 12 3C16.9706 3 21 6.80558 21 11.5Z"
        fill="#041209"
        fillOpacity="0.8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="11.5" r="1" fill="currentColor" />
      <circle cx="12" cy="11.5" r="1" fill="currentColor" />
      <circle cx="16" cy="11.5" r="1" fill="currentColor" />
    </svg>
  );
}
