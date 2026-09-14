export function IgnitionThread({ variant = "flow" }: { variant?: "flow" | "converge" }) {
  return <div className={`ignition-thread ignition-thread--${variant}`} aria-hidden="true"><svg viewBox="0 0 480 180" focusable="false"><path d="M4 130 C95 130 102 35 190 75 S290 165 356 93 S404 54 476 54" /><circle cx="52" cy="128" r="4" /><circle cx="190" cy="75" r="5" /><circle cx="356" cy="93" r="5" /><circle cx="452" cy="54" r="7" /></svg></div>;
}
