import { Navigate } from "react-router-dom";
import { isLoggedIn } from "@/lib/auth";

const Index = () => {
  // If already logged in, go to dashboard
  if (isLoggedIn()) {
    return <Navigate to="/dashboard" replace />;
  }
  
  // Otherwise, show login (we can just render the Login component here)
  return <Navigate to="/" replace />;
};

export default Index;
