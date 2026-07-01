import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-20 text-center">
      <div>
        <p className="eyebrow text-brand-dark">404</p>
        <h1 className="display mt-2 text-5xl">Page not found</h1>
        <p className="mt-3 text-content-muted">This page doesn’t exist or has moved.</p>
        <Link to="/" className="btn-primary mt-6">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
