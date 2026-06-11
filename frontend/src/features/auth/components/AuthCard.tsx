interface AuthCardProps {
  readonly children: React.ReactNode;
}

export function AuthCard({ children }: AuthCardProps): React.ReactElement {
  return (
    <div className="rounded-2xl border border-purple-500/30 bg-gray-950/80 backdrop-blur-md px-8 py-10 shadow-[0_0_40px_rgba(168,85,247,0.15)]">
      {children}
    </div>
  );
}
