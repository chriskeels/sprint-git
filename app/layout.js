export const metadata = {
  title: 'BrightPath Tutoring',
  description: 'BrightPath platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
