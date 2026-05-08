interface PageHeaderProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps): React.ReactElement {
  return (
    <div className="mb-6 flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
