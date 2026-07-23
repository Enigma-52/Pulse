import { Link } from "react-router-dom";
import { Activity } from "lucide-react";

const NotFound = () => (
  <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
    <div className="panel p-8 text-center max-w-sm">
      <div className="w-8 h-8 rounded-sm bg-primary flex items-center justify-center mx-auto mb-4">
        <Activity className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
      </div>
      <div className="text-3xl font-mono font-medium">404</div>
      <p className="mt-2 text-sm text-muted-foreground">This page doesn't exist.</p>
      <Link
        to="/app"
        className="mt-6 inline-flex h-8 px-4 items-center text-xs font-medium rounded bg-primary text-primary-foreground hover:opacity-90"
      >
        Back to dashboard
      </Link>
    </div>
  </div>
);

export default NotFound;
