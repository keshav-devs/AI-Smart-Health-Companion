/**
 * App logo — scalable SVG mark + wordmark.
 */

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

const sizes = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-14 h-14",
};

const textSizes = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
};

export function Logo({ size = "md", showText = true }: LogoProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Heart + cross icon */}
      <div
        className={`${sizes[size]} rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-md`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-3/5 h-3/5 text-white"
          aria-hidden="true"
        >
          <path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5
               2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09
               C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5
               c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            fill="currentColor"
          />
          <rect x="11" y="7" width="2" height="8" rx="1" fill="rgba(255,255,255,0.5)" />
          <rect x="8" y="10" width="8" height="2" rx="1" fill="rgba(255,255,255,0.5)" />
        </svg>
      </div>

      {showText && (
        <div>
          <p className={`${textSizes[size]} font-bold text-gray-900 leading-tight`}>
            Health<span className="text-primary-600">Companion</span>
          </p>
          {size === "lg" && (
            <p className="text-xs text-gray-500 tracking-wide">
              AI-Powered Health Management
            </p>
          )}
        </div>
      )}
    </div>
  );
}
