export const validateLocation = (location) => {
  if (!location || typeof location !== "object") {
    throw new Error("Invalid location object");
  }

  const { lat, lng } = location;

  if (typeof lat !== "number" || typeof lng !== "number") {
    throw new Error("Location coordinates must be numbers");
  }

  if (lat < -90 || lat > 90) {
    throw new Error("Latitude must be between -90 and 90");
  }

  if (lng < -180 || lng > 180) {
    throw new Error("Longitude must be between -180 and 180");
  }

  return { lat, lng };
};

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error("Invalid email format");
  }
  return email.trim().toLowerCase();
};

export const validateMatricNo = (matricNo) => {
  if (!matricNo || typeof matricNo !== "string" || matricNo.trim().length === 0) {
    throw new Error("Matric number is required");
  }
  return matricNo.trim();
};

export const validatePassword = (password) => {
  if (!password || typeof password !== "string" || password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }
  return password;
};

export const validateCourseCode = (code) => {
  if (!code || typeof code !== "string" || code.trim().length === 0) {
    throw new Error("Course code is required");
  }
  return code.trim().toUpperCase();
};

export const validateCourseTitle = (title) => {
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    throw new Error("Course title is required");
  }
  return title.trim();
};

export const validateName = (name) => {
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw new Error("Name is required");
  }
  if (name.trim().length > 100) {
    throw new Error("Name is too long");
  }
  return name.trim();
};
