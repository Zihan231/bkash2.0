'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { isValidPhone, normalizePhone, PHONE_VALIDATION_MESSAGE } from '@/lib/utils';
import { COLLEGES } from '@/lib/social-campaign';
import { addSubmission, type NewSocialSubmission } from '@/lib/social-store';

// Demo/prototype mode: no backend calls. OTP sending and verification are simulated,
// and submissions are saved in this browser's IndexedDB for the /admin page.
const DEMO_OTP = '123456';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function demoRequestOtp() {
  await wait(900);
}

async function demoVerifyOtp(code: string) {
  await wait(800);
  if (code !== DEMO_OTP) throw new Error('Invalid or expired verification code.');
}

async function demoSaveSubmission(data: NewSocialSubmission) {
  await wait(600);
  await addSubmission(data);
}

const INTRO_POPUP_SRC = encodeURI('/Asset 1@5x.png');

const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type FieldName = 'name' | 'college' | 'contactNumber' | 'bkashNumber' | 'friendBkashNumber' | 'screenshot';
type FormErrors = Partial<Record<FieldName | 'form', string>>;
type View = 'form' | 'otp' | 'success';

interface SocialFormData {
  name: string;
  college: string;
  contactNumber: string;
  bkashNumber: string;
  friendBkashNumber: string;
}

const initialForm: SocialFormData = {
  name: '',
  college: '',
  contactNumber: '',
  bkashNumber: '',
  friendBkashNumber: '',
};

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    </svg>
  );
}

function SuccessIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 12 3.2 3.2L17.5 8" />
    </svg>
  );
}

export default function SocialSubmissionForm() {
  const [form, setForm] = useState<SocialFormData>(initialForm);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<View>('form');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const introCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showIntro) return;
    introCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeIntro();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showIntro]);

  const closeIntro = () => setShowIntro(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    if (!screenshot) {
      setPreviewUrl('');
      return;
    }
    const nextUrl = URL.createObjectURL(screenshot);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [screenshot]);

  const updateField = (field: keyof SocialFormData, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setScreenshot(null);
      return;
    }

    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      setScreenshot(null);
      setErrors((current) => ({ ...current, screenshot: 'Upload a JPG, PNG, or WEBP image.' }));
      event.target.value = '';
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setScreenshot(null);
      setErrors((current) => ({ ...current, screenshot: 'The screenshot must be 10 MB or smaller.' }));
      event.target.value = '';
      return;
    }

    setScreenshot(file);
    setErrors((current) => ({ ...current, screenshot: undefined, form: undefined }));
  };

  const validate = () => {
    const nextErrors: FormErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Your name is required.';
    if (!form.college) nextErrors.college = 'Please select your college.';
    if (!form.contactNumber.trim()) nextErrors.contactNumber = 'Your contact number is required.';
    else if (!isValidPhone(form.contactNumber)) nextErrors.contactNumber = PHONE_VALIDATION_MESSAGE;
    if (!form.bkashNumber.trim()) nextErrors.bkashNumber = 'Your bKash number is required.';
    else if (!isValidPhone(form.bkashNumber)) nextErrors.bkashNumber = PHONE_VALIDATION_MESSAGE;
    if (!form.friendBkashNumber.trim()) nextErrors.friendBkashNumber = "Your friend's bKash number is required.";
    else if (!isValidPhone(form.friendBkashNumber)) nextErrors.friendBkashNumber = PHONE_VALIDATION_MESSAGE;
    if (!screenshot) nextErrors.screenshot = 'Please attach a screenshot.';
    return nextErrors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await demoRequestOtp();

      setOtp('');
      setOtpError('');
      setOtpVerified(false);
      setResent(false);
      setView('otp');
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : 'Could not send the verification code. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const saveSubmission = async () => {
    await demoSaveSubmission({
      name: form.name.trim(),
      college: form.college,
      contactNumber: normalizePhone(form.contactNumber.trim()),
      bkashNumber: normalizePhone(form.bkashNumber.trim()),
      friendBkashNumber: normalizePhone(form.friendBkashNumber.trim()),
      screenshot: screenshot as File,
      screenshotName: (screenshot as File).name,
    });
    setView('success');
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (verifying) return;
    if (!otpVerified && !/^\d{6}$/.test(otp)) {
      setOtpError('Enter the 6-digit verification code.');
      return;
    }

    setVerifying(true);
    setOtpError('');
    try {
      if (!otpVerified) {
        await demoVerifyOtp(otp);
        setOtpVerified(true);
      }
      await saveSubmission();
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : 'Could not complete your submission. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const resendOtp = async () => {
    if (resending) return;
    setResending(true);
    setOtpError('');
    try {
      await demoRequestOtp();
      setOtp('');
      setOtpVerified(false);
      setResent(true);
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : 'Could not resend the code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const editDetails = () => {
    setOtp('');
    setOtpError('');
    setOtpVerified(false);
    setResent(false);
    setView('form');
  };

  const resetForm = () => {
    setForm(initialForm);
    setScreenshot(null);
    setErrors({});
    setOtp('');
    setOtpError('');
    setOtpVerified(false);
    setResent(false);
    setView('form');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <main className="kiosk social-page">
      {showIntro && (
        <div className="social-intro-overlay" onClick={closeIntro}>
          <div
            className="social-intro-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Met on Day One campaign: how to participate"
            onClick={(event) => event.stopPropagation()}
          >
            <button ref={introCloseRef} type="button" className="social-intro-close" onClick={closeIntro} aria-label="Close">×</button>
            <img
              src={INTRO_POPUP_SRC}
              alt="Met on Day One: 1. Take a picture of the Polaroid while holding it. 2. Upload it on Facebook or Instagram as a post or story. 3. Tag your friend and use #day1withbKash. 4. Submit the screenshot through the link shared via SMS. Get a 100 Taka education fee coupon."
            />
            <button type="button" className="kiosk-btn-primary social-intro-cta" onClick={closeIntro}>
              <span>Participate Now</span>
              <span className="btn-arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}
      <div className="kiosk-inner social-inner">
        <div className="kiosk-logo">
          <img src="/logos/bkash.svg" alt="bKash" />
        </div>

        <div className="kiosk-content social-content">
          {view === 'success' ? (
            <section className="kiosk-card fade-in social-success" aria-labelledby="social-success-title">
              <div className="social-success-icon"><SuccessIcon /></div>
              <p className="social-eyebrow">Submission complete</p>
              <h1 className="kiosk-title" id="social-success-title">Thank you!</h1>
              <p className="kiosk-sub">Your information and screenshot have been submitted successfully.</p>
              <button type="button" className="kiosk-btn-secondary" onClick={resetForm}>Submit another response</button>
            </section>
          ) : view === 'otp' ? (
            <section className="kiosk-card fade-in social-otp-card" aria-labelledby="social-otp-title">
              <div className="social-otp-icon" aria-hidden="true">123</div>
              <p className="social-eyebrow">One last step</p>
              <h1 className="kiosk-title" id="social-otp-title">Verify your contact number</h1>
              <p className="kiosk-sub">
                We sent a 6-digit code to <strong>{form.contactNumber}</strong>. The code expires in a few minutes.
              </p>

              <form onSubmit={handleVerify} noValidate>
                <div className="kiosk-field social-otp-field">
                  <label htmlFor="social-otp">Verification Code <span className="req" aria-hidden="true">*</span></label>
                  <input
                    id="social-otp"
                    name="otp"
                    type="text"
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    placeholder="123456"
                    value={otp}
                    onChange={(event) => {
                      setOtp(event.target.value.replace(/\D/g, '').slice(0, 6));
                      setOtpError('');
                      setOtpVerified(false);
                    }}
                    aria-invalid={Boolean(otpError)}
                    aria-describedby={otpError ? 'social-otp-error' : 'social-otp-help'}
                    autoFocus
                  />
                  <span className="social-otp-help" id="social-otp-help">Demo mode: use code <strong>{DEMO_OTP}</strong>.</span>
                  {otpError && <span className="field-err" id="social-otp-error" role="alert">{otpError}</span>}
                </div>

                <button className="kiosk-btn-primary" type="submit" disabled={verifying || (!otpVerified && otp.length !== 6)}>
                  <span>{verifying ? (otpVerified ? 'Saving…' : 'Verifying…') : otpVerified ? 'Try Saving Again' : 'Verify & Complete Submission'}</span>
                  {verifying ? <span className="social-button-spinner" aria-hidden="true" /> : <span className="btn-arrow" aria-hidden="true">→</span>}
                </button>

                <div className="social-otp-actions">
                  <button type="button" className="social-text-button" onClick={editDetails} disabled={verifying}>Edit details</button>
                  <button type="button" className="social-text-button" onClick={resendOtp} disabled={resending || verifying}>
                    {resending ? 'Resending…' : resent ? 'Code resent' : 'Resend code'}
                  </button>
                </div>
                <p className="social-status" role="status" aria-live="polite">
                  {verifying ? (otpVerified ? 'Saving your submission…' : 'Verifying your code…') : resent ? 'A new verification code has been sent.' : ''}
                </p>
              </form>
            </section>
          ) : (
            <section className="kiosk-card fade-in social-card" aria-labelledby="social-form-title">
              <div className="social-heading">
                <p className="social-eyebrow">Social campaign</p>
                <h1 className="kiosk-title" id="social-form-title">
                  Share your <span className="title-accent">details</span>
                </h1>
                <p className="kiosk-sub">Fill in the form and attach your screenshot to participate.</p>
              </div>

              <form onSubmit={handleSubmit} noValidate>
                <div className="social-form-grid">
                  <div className="kiosk-field social-field-full">
                    <label htmlFor="social-name">Your Name <span className="req" aria-hidden="true">*</span></label>
                    <input
                      id="social-name"
                      name="name"
                      type="text"
                      required
                      autoComplete="name"
                      maxLength={100}
                      placeholder="Enter your full name"
                      value={form.name}
                      onChange={(event) => updateField('name', event.target.value)}
                      aria-invalid={Boolean(errors.name)}
                      aria-describedby={errors.name ? 'social-name-error' : undefined}
                    />
                    {errors.name && <span className="field-err" id="social-name-error">{errors.name}</span>}
                  </div>

                  <div className="kiosk-field social-field-full">
                    <label htmlFor="social-college">Your College <span className="req" aria-hidden="true">*</span></label>
                    <div className="social-select-wrap">
                      <select
                        id="social-college"
                        name="college"
                        required
                        value={form.college}
                        onChange={(event) => updateField('college', event.target.value)}
                        aria-invalid={Boolean(errors.college)}
                        aria-describedby={errors.college ? 'social-college-error' : undefined}
                      >
                        <option value="" disabled>Select your college</option>
                        {COLLEGES.map((college) => <option key={college} value={college}>{college}</option>)}
                      </select>
                    </div>
                    {errors.college && <span className="field-err" id="social-college-error">{errors.college}</span>}
                  </div>

                  <div className="kiosk-field">
                    <label htmlFor="social-contact">Your Contact Number <span className="req" aria-hidden="true">*</span></label>
                    <input
                      id="social-contact"
                      name="contactNumber"
                      type="tel"
                      required
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="01XXXXXXXXX"
                      value={form.contactNumber}
                      onChange={(event) => updateField('contactNumber', event.target.value)}
                      aria-invalid={Boolean(errors.contactNumber)}
                      aria-describedby={errors.contactNumber ? 'social-contact-error' : undefined}
                    />
                    {errors.contactNumber && <span className="field-err" id="social-contact-error">{errors.contactNumber}</span>}
                  </div>

                  <div className="kiosk-field">
                    <label htmlFor="social-bkash">Your bKash Number <span className="req" aria-hidden="true">*</span></label>
                    <input
                      id="social-bkash"
                      name="bkashNumber"
                      type="tel"
                      required
                      inputMode="tel"
                      placeholder="01XXXXXXXXX"
                      value={form.bkashNumber}
                      onChange={(event) => updateField('bkashNumber', event.target.value)}
                      aria-invalid={Boolean(errors.bkashNumber)}
                      aria-describedby={errors.bkashNumber ? 'social-bkash-error' : undefined}
                    />
                    {errors.bkashNumber && <span className="field-err" id="social-bkash-error">{errors.bkashNumber}</span>}
                  </div>

                  <div className="kiosk-field social-field-full">
                    <label htmlFor="social-friend-bkash">Your Friend&apos;s bKash Number <span className="req" aria-hidden="true">*</span></label>
                    <input
                      id="social-friend-bkash"
                      name="friendBkashNumber"
                      type="tel"
                      required
                      inputMode="tel"
                      placeholder="01XXXXXXXXX"
                      value={form.friendBkashNumber}
                      onChange={(event) => updateField('friendBkashNumber', event.target.value)}
                      aria-invalid={Boolean(errors.friendBkashNumber)}
                      aria-describedby={errors.friendBkashNumber ? 'social-friend-bkash-error' : undefined}
                    />
                    {errors.friendBkashNumber && <span className="field-err" id="social-friend-bkash-error">{errors.friendBkashNumber}</span>}
                  </div>

                  <div className="kiosk-field social-field-full">
                    <label htmlFor="social-screenshot">Attach Screenshot <span className="req" aria-hidden="true">*</span></label>
                    <input
                      ref={fileInputRef}
                      id="social-screenshot"
                      className="social-file-input"
                      name="screenshot"
                      type="file"
                      required
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileChange}
                      aria-invalid={Boolean(errors.screenshot)}
                      aria-describedby="social-upload-help social-screenshot-error"
                    />
                    <label className={`social-upload ${screenshot ? 'has-file' : ''}`} htmlFor="social-screenshot">
                      {previewUrl ? (
                        <img src={previewUrl} alt="Selected screenshot preview" />
                      ) : (
                        <span className="social-upload-icon"><UploadIcon /></span>
                      )}
                      <span className="social-upload-copy">
                        <strong>{screenshot ? screenshot.name : 'Choose a screenshot'}</strong>
                        <span id="social-upload-help">JPG, PNG, or WEBP · Maximum 10 MB</span>
                      </span>
                      <span className="social-upload-action">{screenshot ? 'Change' : 'Browse'}</span>
                    </label>
                    {errors.screenshot && <span className="field-err" id="social-screenshot-error">{errors.screenshot}</span>}
                  </div>
                </div>

                {errors.form && <p className="social-form-error" role="alert">{errors.form}</p>}

                <button className="kiosk-btn-primary" type="submit" disabled={submitting}>
                  <span>{submitting ? 'Sending Code…' : 'Submit Information'}</span>
                  {submitting ? <span className="social-button-spinner" aria-hidden="true" /> : <span className="btn-arrow" aria-hidden="true">→</span>}
                </button>
                <p className="trust-line">Your information will only be used for this campaign.</p>
                <p className="social-status" role="status" aria-live="polite">{submitting ? 'Sending a verification code to your contact number…' : ''}</p>
              </form>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
