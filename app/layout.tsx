import './globals.css';
export const metadata = {
  title: 'Next.js Custom Cursor',
  description: 'Smooth cursor animation built with Next.js App Router',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Mount cursor globally */}
        {children}
      </body>
    </html>
  );
}