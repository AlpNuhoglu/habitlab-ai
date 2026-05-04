interface AuthCardProps {
  readonly children: React.ReactNode;
}

export function AuthCard({ children }: AuthCardProps): React.ReactElement {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-8 py-10">
      {children}
    </div>
  );
}
