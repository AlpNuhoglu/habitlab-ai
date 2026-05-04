import { Link } from 'react-router-dom';

interface AuthFooterLink {
  readonly label: string;
  readonly to: string;
}

interface AuthFooterProps {
  readonly links: AuthFooterLink[];
}

export function AuthFooter({ links }: AuthFooterProps): React.ReactElement {
  return (
    <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-gray-500">
      {links.map(({ label, to }) => (
        <Link
          key={to}
          to={to}
          className="hover:text-navy-700 hover:underline transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 rounded"
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
