'use client';

export default function Home() {
  return (
    <iframe
      src="/index.html"
      title="Waste Classifier"
      style={{
        border: 'none',
        width: '100vw',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
      }}
    />
  );
}
