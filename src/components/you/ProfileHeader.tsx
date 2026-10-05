"use client";

import { useRef, useState } from "react";
import { CameraIcon, CheckIcon, PencilIcon, TrashIcon, UserIcon } from "@/components/icons/Icons";
import Sheet from "@/components/ui/Sheet";
import { useT } from "@/lib/i18n/I18nProvider";
import AvatarCropper from "./AvatarCropper";
import { MAX_AVATAR_INPUT_BYTES, MAX_NAME_LENGTH, setAvatar, setName, useAvatar, useProfileName } from "./avatar";
import styles from "./You.module.css";

/**
 * Top of the You tab: an editable profile photo (framed by the user in a crop editor) and
 * display name, both stored on this device only. Wallet details live in the Wallet section.
 */
export default function ProfileHeader() {
  const t = useT("you");
  const avatar = useAvatar();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<"photoNotImage" | "photoTooLarge" | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const name = useProfileName();
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState("");

  function startEditing() {
    setDraft(name);
    setEditingName(true);
  }

  function saveName() {
    setName(draft);
    setEditingName(false);
  }

  function choosePhoto() {
    setMenuOpen(false);
    setError(null);
    inputRef.current?.click();
  }

  function onFile(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("photoNotImage");
      return;
    }
    if (file.size > MAX_AVATAR_INPUT_BYTES) {
      setError("photoTooLarge");
      return;
    }
    setCropFile(file);
  }

  return (
    <section className={styles.profile} aria-label={t("profileLabel")}>
      <button
        type="button"
        className={styles.avatarButton}
        onClick={() => (avatar ? setMenuOpen(true) : choosePhoto())}
        aria-label={avatar ? t("changePhoto") : t("addPhoto")}
      >
        <span className={styles.avatar} data-has-photo={avatar ? "" : undefined}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL, nothing to optimize
            <img src={avatar} alt="" className={styles.avatarImg} />
          ) : (
            <UserIcon size={34} />
          )}
        </span>
        <span className={styles.avatarEdit} aria-hidden="true">
          <CameraIcon size={15} />
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      <div className={styles.profileText}>
        {editingName ? (
          <form
            className={styles.nameForm}
            onSubmit={(e) => {
              e.preventDefault();
              saveName();
            }}
          >
            <input
              className={styles.nameInput}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditingName(false);
              }}
              onBlur={saveName}
              maxLength={MAX_NAME_LENGTH}
              placeholder={t("namePlaceholder")}
              aria-label={t("namePlaceholder")}
              autoComplete="nickname"
              enterKeyHint="done"
              autoFocus
            />
            <button type="submit" className={styles.nameIconButton} aria-label={t("saveName")} onMouseDown={(e) => e.preventDefault()}>
              <CheckIcon size={18} />
            </button>
          </form>
        ) : (
          <div className={styles.nameRow}>
            <h2 className={styles.profileName} data-placeholder={name ? undefined : ""}>
              {name || t("addName")}
            </h2>
            <button
              type="button"
              className={styles.nameIconButton}
              onClick={startEditing}
              aria-label={name ? t("editName") : t("addName")}
            >
              <PencilIcon size={16} />
            </button>
          </div>
        )}
        {error ? (
          <p className={styles.avatarError} aria-live="polite">
            {t(error)}
          </p>
        ) : null}
      </div>

      <Sheet open={cropFile !== null} onClose={() => setCropFile(null)} title={t("adjustPhotoTitle")}>
        {cropFile ? (
          <AvatarCropper
            file={cropFile}
            onCancel={() => setCropFile(null)}
            onSave={(dataUrl) => {
              setAvatar(dataUrl);
              setCropFile(null);
            }}
          />
        ) : null}
      </Sheet>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={t("photoMenuTitle")}>
        <div className={styles.avatarMenu}>
          <button type="button" className={styles.avatarMenuItem} onClick={choosePhoto}>
            <CameraIcon size={20} />
            {t("chooseNewPhoto")}
          </button>
          <button
            type="button"
            className={styles.avatarMenuItem}
            data-danger=""
            onClick={() => {
              setAvatar(null);
              setMenuOpen(false);
            }}
          >
            <TrashIcon size={20} />
            {t("removePhoto")}
          </button>
          <p className={styles.avatarNote}>{t("photoStaysOnDevice")}</p>
        </div>
      </Sheet>
    </section>
  );
}
