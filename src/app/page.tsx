"use client";

import Script from "next/script";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [vantaLoaded, setVantaLoaded] = useState(false);
  const [threeLoaded, setThreeLoaded] = useState(false);
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Check if already logged in - only once
    if (hasRedirected.current) return;
    
    const controller = new AbortController();
    
    const checkSession = async () => {
      try {
        const res = await fetch("/api/auth/session", { 
          signal: controller.signal,
          credentials: "include",
          cache: "no-store",
        });
        
        if (!res.ok) {
          setCheckingSession(false);
          return;
        }
        
        const data = await res.json();
        
        if (data.user && !hasRedirected.current) {
          hasRedirected.current = true;
          if (data.user.isAdmin) {
            router.replace("/admin");
          } else {
            router.replace("/team");
          }
        } else {
          setCheckingSession(false);
        }
      } catch (error) {
        // Don't treat aborted requests as errors
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        setCheckingSession(false);
      }
    };
    
    checkSession();
    
    return () => {
      controller.abort();
    };
  }, [router]);

  useEffect(() => {
    if (
      threeLoaded &&
      vantaLoaded &&
      typeof window !== "undefined" &&
      (window as unknown as Record<string, unknown>).VANTA &&
      (window as unknown as Record<string, unknown>).THREE
    ) {
      try {
        const VANTA = (window as unknown as Record<string, { GLOBE: (options: Record<string, unknown>) => void }>).VANTA;
        VANTA.GLOBE({
          el: "#vanta-bg",
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.0,
          minWidth: 200.0,
          scale: 1.0,
          scaleMobile: 1.0,
          color: 0xe8105a,
          backgroundColor: 0x3c1530,
          size: 1.2,
          backgroundAlpha: 1.0,
        });
      } catch (e) {
        console.warn("VANTA init failed:", e);
      }
    }
  }, [threeLoaded, vantaLoaded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Use username as-is (normalization only happens on team creation)
    const trimmedUsername = username.trim();

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmedUsername, password }),
        credentials: "include",
        cache: "no-store",
      });

      const data = await res.json();

      if (data.success) {
        if (data.isAdmin) {
          router.replace("/admin");
        } else {
          router.replace("/team");
        }
      } else {
        setError(data.message || "Invalid credentials");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking session
  if (checkingSession) {
    return (
      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center", 
        height: "100vh",
        background: "#1a1a2e",
        color: "#e5e7eb"
      }}>
        Loading...
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"
        strategy="afterInteractive"
        onLoad={() => setThreeLoaded(true)}
      />
      {threeLoaded && (
        <Script
          src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.globe.min.js"
          strategy="afterInteractive"
          onLoad={() => setVantaLoaded(true)}
        />
      )}

      <div id="vanta-bg"></div>

      <div className="container">
        <div className="header">
          <h1>Binary Battles 0.3</h1>
          <p>Timed Coding Competition</p>
        </div>

        <div className="login-container">
          <h2>Login</h2>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Registration Number</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter registration number"
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
      <div className="dev-footer">developed by students of VIT</div>
    </>
  );
}
