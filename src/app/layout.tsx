import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Flashcard Frenzy Multiplayer",
  description: "Real-time multiplayer quiz game",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
          {children}
        </main>
      </body>
    </html>
  );
}
