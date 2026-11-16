import { avatarOptions } from './data.js';

export default function Avatar({ value, label = '', className = '' }) {
  const avatar = avatarOptions.find((option) => option.src === value);
  if (avatar) return <img className={`avatar-image ${className}`} src={avatar.src} alt={label} draggable="false" />;
  return label ? <span aria-label={label}>{value || '⭐'}</span> : <>{value || '⭐'}</>;
}
