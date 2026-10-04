"use client";

import { useRef, useState } from "react";
import { CameraIcon, CheckIcon, PencilIcon, TrashIcon, UserIcon } from "@/components/icons/Icons";
import Sheet from "@/components/ui/Sheet";
import AvatarCropper from "./AvatarCropper";
import { MAX_AVATAR_INPUT_BYTES, MAX_NAME_LENGTH, setAvatar, setName, useAvatar, useProfileName } from "./avatar";
import styles from "./You.module.css";

/**
 * Top of the You tab: an editable profile photo (framed by the user in a crop editor) and
 * display name, both stored on this device only. Wallet details live in the Wallet section.
 */
export default function ProfileHeader() {
  const avatar = useAvatar();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_INPUT_BYTES) {
      setError("That image is too large.");
      return;
    }
    setCropFile(file);
  }

  return (
    <section className={styles.profile} aria-label="Profile">
      <button
        type="button"
        className={styles.avatarButton}
        onClick={() => (avatar ? setMenuOpen(true) : choosePhoto())}
        aria-label={avatar ? "Change profile photo" : "Add profile photo"}
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
              placeholder="Your name"
              aria-label="Your name"
              autoComplete="nickname"
              enterKeyHint="done"
              autoFocus
            />
            <button type="submit" className={styles.nameIconButton} aria-label="Save name" onMouseDown={(e) => e.preventDefault()}>
              <CheckIcon size={18} />
            </button>
          </form>
        ) : (
          <div className={styles.nameRow}>
            <h2 className={styles.profileName} data-placeholder={name ? undefined : ""}>
              {name || "Add your name"}
            </h2>
            <button
              type="button"
              className={styles.nameIconButton}
              onClick={startEditing}
              aria-label={name ? "Edit name" : "Add your name"}
            >
              <PencilIcon size={16} />
            </button>
          </div>
        )}
        {error ? (
          <p className={styles.avatarError} aria-live="polite">
            {error}
          </p>
        ) : null}
      </div>

      <Sheet open={cropFile !== null} onClose={() => setCropFile(null)} title="Adjust photo">
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

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Profile photo">
        <div className={styles.avatarMenu}>
          <button type="button" className={styles.avatarMenuItem} onClick={choosePhoto}>
            <CameraIcon size={20} />
            Choose a new photo
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
            Remove photo
          </button>
          <p className={styles.avatarNote}>Your photo stays on this device. It is never uploaded.</p>
        </div>
      </Sheet>
    </section>
  );
}
