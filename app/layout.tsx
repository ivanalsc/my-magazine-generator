import { initialAccountState } from "@/lib/account/initial-state";
import { AccountProvider } from "@/components/account/AccountProvider";
import type { Metadata } from "next";
import { DM_Sans, Libre_Caslon_Display } from "next/font/google";
import "./globals.css";
const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const serif = Libre_Caslon_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
});
export const metadata: Metadata = {
  title: "My Magazine Generator — A magazine made for you",
  description:
    "A magazine made from the things you’re curious about. Curated, never rewritten.",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialState = await initialAccountState();
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable}`}>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <AccountProvider initialState={initialState}>
          {children}
        </AccountProvider>
      </body>
    </html>
  );
}
