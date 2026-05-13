interface Props {
  readonly children: React.ReactNode;
}

export function KpiTileGrid({ children }: Props): React.ReactElement {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {children}
    </div>
  );
}
