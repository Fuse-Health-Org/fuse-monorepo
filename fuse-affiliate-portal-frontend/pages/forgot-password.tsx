import React from "react";
import { motion } from "framer-motion";
import { Button, Input, Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { apiCall } from "../lib/api";
import Head from "next/head";

type Step = "email" | "code" | "reset";

export default function ForgotPassword() {
  const [step, setStep] = React.useState<Step>("email");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");
  const [resendCooldown, setResendCooldown] = React.useState(0);
  const [showSuccessModal, setShowSuccessModal] = React.useState(false);
  const codeInputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  // Resend cooldown timer
  React.useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const result = await apiCall("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to send reset code");
      }

      setSuccessMessage("Reset code sent to your email!");
      setStep("code");
      setResendCooldown(60); // 60 second cooldown
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    if (digit && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      setCode(pastedData.split(''));
      codeInputRefs.current[5]?.focus();
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const codeString = code.join('').trim();
    if (codeString.length !== 6) return;

    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const result = await apiCall("/auth/verify-reset-code", {
        method: "POST",
        body: JSON.stringify({ email, code: codeString }),
      });

      if (!result.success) {
        throw new Error(result.error || "Invalid or expired code");
      }

      setSuccessMessage("Code verified! Please set your new password.");
      setStep("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code. Please try again.");
      setCode(['', '', '', '', '', '']);
      codeInputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    
    setIsLoading(true);
    setError("");

    try {
      const result = await apiCall("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to resend code");
      }

      setSuccessMessage("New code sent to your email!");
      setResendCooldown(60);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const codeString = code.join('').trim();
      const result = await apiCall("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          email,
          code: codeString,
          password: newPassword,
          confirmPassword,
        }),
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to reset password");
      }

      // Show success modal instead of redirecting
      setShowSuccessModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Reset Password - Affiliate Portal</title>
      </Head>
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Card className="border-border shadow-lg">
            <CardBody className="p-8">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <Icon icon="lucide:lock" className="text-3xl text-primary" />
                  </div>
                </div>
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  {step === "email" && "Reset Password"}
                  {step === "code" && "Verify Code"}
                  {step === "reset" && "New Password"}
                </h1>
                <p className="text-muted-foreground">
                  {step === "email" && "Enter your email to receive a reset code"}
                  {step === "code" && `We sent a 6-digit code to ${email}`}
                  {step === "reset" && "Enter your new password"}
                </p>
              </div>

              {/* Success Message */}
              {successMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-success-50 border border-success-200 text-success-600 px-4 py-3 rounded-lg text-sm mb-4"
                >
                  {successMessage}
                </motion.div>
              )}

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-danger-50 border border-danger-200 text-danger-600 px-4 py-3 rounded-lg text-sm mb-4"
                >
                  {error}
                </motion.div>
              )}

              {/* Step 1: Email */}
              {step === "email" && (
                <form onSubmit={handleEmailSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">
                      Email
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                      className="w-full"
                      startContent={
                        <Icon icon="lucide:mail" className="text-lg text-muted-foreground" />
                      }
                    />
                  </div>

                  <Button
                    type="submit"
                    color="primary"
                    className="w-full"
                    size="lg"
                    isLoading={isLoading}
                    disabled={isLoading || !email}
                  >
                    {isLoading ? "Sending..." : "Send Reset Code"}
                  </Button>

                  <div className="text-center">
                    <Link href="/signin" className="text-sm text-primary hover:underline">
                      Back to sign in
                    </Link>
                  </div>
                </form>
              )}

              {/* Step 2: Code Verification */}
              {step === "code" && (
                <form onSubmit={handleCodeSubmit} className="space-y-6">
                  <div className="flex justify-center gap-2">
                    {code.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => { codeInputRefs.current[index] = el }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleCodeChange(index, e.target.value)}
                        onKeyDown={(e) => handleCodeKeyDown(index, e)}
                        onPaste={handleCodePaste}
                        className="w-12 h-14 text-center text-2xl font-bold border-2 border-content3 rounded-xl bg-content1 text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>

                  <p className="text-xs text-center text-muted-foreground">
                    Code expires in 10 minutes
                  </p>

                  <Button
                    type="submit"
                    color="primary"
                    className="w-full"
                    size="lg"
                    isLoading={isLoading}
                    isDisabled={code.join('').length !== 6}
                  >
                    {isLoading ? "Verifying..." : "Verify Code"}
                  </Button>

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={resendCooldown > 0 || isLoading}
                      className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Icon icon="lucide:refresh-cw" className="w-4 h-4" />
                      {resendCooldown > 0 
                        ? `Resend code in ${resendCooldown}s`
                        : "Resend code"
                      }
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setStep("email");
                        setCode(['', '', '', '', '', '']);
                        setError("");
                      }}
                      className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Icon icon="lucide:arrow-left" className="w-4 h-4" />
                      Change email
                    </button>
                  </div>
                </form>
              )}

              {/* Step 3: Reset Password */}
              {step === "reset" && (
                <form onSubmit={handleResetPassword} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">
                      New Password
                    </label>
                    <Input
                      type={isPasswordVisible ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      required
                      className="w-full"
                      startContent={
                        <Icon icon="lucide:lock" className="text-lg text-muted-foreground" />
                      }
                      endContent={
                        <button
                          type="button"
                          onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                          className="focus:outline-none"
                        >
                          <Icon
                            icon={isPasswordVisible ? "lucide:eye-off" : "lucide:eye"}
                            className="text-lg text-muted-foreground"
                          />
                        </button>
                      }
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Must be at least 8 characters long
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">
                      Confirm Password
                    </label>
                    <Input
                      type={isConfirmPasswordVisible ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      required
                      className="w-full"
                      startContent={
                        <Icon icon="lucide:lock" className="text-lg text-muted-foreground" />
                      }
                      endContent={
                        <button
                          type="button"
                          onClick={() => setIsConfirmPasswordVisible(!isConfirmPasswordVisible)}
                          className="focus:outline-none"
                        >
                          <Icon
                            icon={isConfirmPasswordVisible ? "lucide:eye-off" : "lucide:eye"}
                            className="text-lg text-muted-foreground"
                          />
                        </button>
                      }
                    />
                  </div>

                  <Button
                    type="submit"
                    color="primary"
                    className="w-full"
                    size="lg"
                    isLoading={isLoading}
                    disabled={isLoading || !newPassword || !confirmPassword}
                  >
                    {isLoading ? "Resetting..." : "Reset Password"}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setStep("code");
                        setNewPassword("");
                        setConfirmPassword("");
                        setError("");
                      }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Icon icon="lucide:arrow-left" className="w-4 h-4 inline mr-1" />
                      Back to code verification
                    </button>
                  </div>
                </form>
              )}
            </CardBody>
          </Card>
        </motion.div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md"
          >
            <Card className="border-border shadow-lg">
              <CardBody className="p-8">
                <div className="text-center space-y-6">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center">
                      <Icon icon="lucide:check-circle" className="text-3xl text-success-600" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">Password Reset Successful!</h2>
                    <p className="text-muted-foreground">
                      Your password has been reset successfully. You can now sign in with your new password.
                    </p>
                  </div>
                  <Button
                    onClick={() => router.push("/signin")}
                    color="primary"
                    className="w-full"
                    size="lg"
                  >
                    Go to Sign In
                  </Button>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        </div>
      )}
    </>
  );
}
