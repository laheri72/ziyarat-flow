import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginStudent } from "@/lib/auth";
import { Loader2, LogIn } from "lucide-react";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError("Please enter your ITS ID or TR Number");
      return;
    }

    setLoading(true);
    setError("");

    const result = await loginStudent(identifier);

    if (result.success) {
      navigate("/dashboard");
    } else {
      setError(result.error || "Access denied");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen login-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="card-elevated p-8 md:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-serif text-foreground mb-2">
              Rawdat Tahera Ziyarat
            </h1>
            <p className="text-muted-foreground text-sm">
              Hadaya Amaliya • Al Jamea tus Saifiyah 
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="identifier"
                className="text-sm font-medium text-foreground"
              >
                ITS ID or TR Number
              </label>
              <Input
                id="identifier"
                type="text"
                placeholder="Enter your ID"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  setError("");
                }}
                className="h-12 text-center text-lg tracking-wide"
                autoComplete="off"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm text-destructive text-center fade-in">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-medium"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5 mr-2" />
                  Continue
                </>
              )}
            </Button>
          </form>

          {/* Footer with my link to github */}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            For Talabat of Al Jamea tus Saifiyah only <br></br>
            made by <a
              href="https://github.com/laheri72/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              @Laheri72
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
