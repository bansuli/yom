import crypto from "crypto";
import { assembleAccount, ingestOnboarding } from "./profile.js";
import {
  createAuthUser,
  findAuthUserByEmail,
  generateMagicLink,
  one,
  rest,
  sbAdmin,
  verifyTokenHash,
} from "./supabase.js";

function randomPassword() {
  return `${crypto.randomUUID()}${crypto.randomUUID()}Aa1!`;
}

export async function findProfileByEmail(email) {
  const want = String(email || "")
    .trim()
    .toLowerCase();
  if (!want) return null;
  const res = await sbAdmin(rest("profiles", `email=eq.${encodeURIComponent(want)}&select=id,email,name`));
  return one(res.data);
}

export async function mintSessionForEmail(email) {
  const link = await generateMagicLink(email);
  const hashed =
    link.data?.hashed_token ||
    link.data?.properties?.hashed_token ||
    link.data?.email_otp ||
    null;
  if (!link.ok || !hashed) {
    throw new Error(link.data?.message || link.data?.msg || "could not mint session");
  }
  const auth = await verifyTokenHash(hashed, "magiclink");
  if (!auth.ok || !auth.data?.access_token) {
    throw new Error(auth.data?.error_description || auth.data?.msg || "could not verify session");
  }
  return auth.data;
}

export async function findOrCreateUserFromGoogle(googleUser = {}, extra = {}) {
  const email = String(googleUser.email || "")
    .trim()
    .toLowerCase();
  if (!email) throw new Error("google account has no email");
  const name = String(googleUser.name || extra.name || email.split("@")[0]).slice(0, 80);

  let authUser = await findAuthUserByEmail(email);
  let created = null;
  if (!authUser) {
    created = await createAuthUser(email, randomPassword(), name);
    if (created.ok && (created.data?.id || created.data?.user?.id)) {
      authUser = created.data?.id ? created.data : created.data.user;
    } else {
      // Creating may have failed because the account already exists, in which
      // case finding it is the right answer. Any other failure is real.
      authUser = await findAuthUserByEmail(email);
    }
  }
  if (!authUser?.id) {
    // Carry what Supabase actually said. Without it this is indistinguishable
    // from a dozen unrelated causes, which is exactly how it stayed unfixed.
    const why = String(
      created?.data?.msg || created?.data?.message || created?.data?.error_description || ""
    ).slice(0, 200);
    console.warn("google signup failed", created?.status, why || "(no message)");
    const err = new Error("Could not create your Yom account.");
    err.detail = why;
    err.status = created?.status || 0;
    throw err;
  }

  await ingestOnboarding(authUser, {
    name,
    email,
    first_surface: extra.first_surface || "google",
    acquisition_source: extra.source || "google",
    acquisition_campaign: extra.campaign || "google_connect",
  });

  return { id: authUser.id, email, name };
}

export async function sessionForUserId(userId) {
  const res = await sbAdmin(rest("profiles", `id=eq.${userId}&select=id,email,name`));
  const profile = one(res.data);
  if (!profile?.email) throw new Error("account missing email");
  const auth = await mintSessionForEmail(profile.email);
  const account = await assembleAccount(auth.user || { id: userId, email: profile.email });
  return {
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
    ...account,
  };
}
