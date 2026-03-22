import { Link } from 'react-router-dom';
import { Leaf, Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto mb-6">
          <Leaf className="w-8 h-8 text-brand-400" />
        </div>
        <h1 className="text-6xl font-bold text-white mb-2">404</h1>
        <p className="text-slate-400 mb-6">This page doesn't exist in our environment.</p>
        <Link to="/dashboard" className="btn-primary inline-flex items-center gap-2">
          <Home className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
