import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "./globals.css";
export const metadata = {
  title: "Clarity — See your spending. Plan your saving.",
  icons: { icon: "/brand/clarity.svg", apple: "/brand/clarity-256.png" },
  description:
    "A private, local money journal. Clear spending insights, thoughtful budgets, and a little more peace of mind.",
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
