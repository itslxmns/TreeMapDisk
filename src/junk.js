'use strict';

// Rules for folders that are usually safe to delete because tools regenerate them.
// `safe: true` items are pre-selected in the cleanup list; the rest must be ticked by hand.
// `when` receives the lowercased names of the folder's siblings, so e.g. `target`
// only counts as Rust output when a Cargo.toml sits next to it.

const hasExt = (siblings, ...exts) => {
  for (const s of siblings) if (exts.some((e) => s.endsWith(e))) return true;
  return false;
};

const RULES = [
  {
    id: 'node_modules', label: 'node_modules', safe: true,
    names: ['node_modules'],
    hint: 'Installed npm packages. Restore with npm install.',
  },
  {
    id: 'py-cache', label: 'Python caches', safe: true,
    names: ['__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache', '.tox'],
    hint: 'Regenerated automatically by Python tools.',
  },
  {
    id: 'js-cache', label: 'JS framework caches', safe: true,
    names: ['.next', '.nuxt', '.parcel-cache', '.turbo', '.svelte-kit', '.angular', '.vite', '.expo'],
    hint: 'Rebuilt on the next dev or build run.',
  },
  {
    id: 'gradle', label: 'Gradle caches', safe: true,
    names: ['.gradle'],
    hint: 'Rebuilt by Gradle.',
  },
  {
    id: 'rust-target', label: 'Rust build output', safe: true,
    names: ['target'], when: (s) => s.has('cargo.toml'),
    hint: 'Rebuilt by cargo build.',
  },
  {
    id: 'dotnet-build', label: '.NET bin / obj', safe: true,
    names: ['bin', 'obj'], when: (s) => hasExt(s, '.csproj', '.fsproj', '.vbproj'),
    hint: 'Rebuilt by dotnet build.',
  },
  {
    id: 'js-build', label: 'JS build output', safe: false,
    names: ['dist', 'build', 'out', '.output'], when: (s) => s.has('package.json'),
    hint: 'Rebuilt by your build script. Check nothing hand-made lives here.',
  },
  {
    id: 'venv', label: 'Python virtualenvs', safe: false,
    names: ['.venv', 'venv'],
    hint: 'Recreate with python -m venv and reinstall packages.',
  },
  {
    id: 'cache', label: 'Cache folders', safe: false,
    names: ['.cache', 'cache', 'caches'],
    hint: 'Usually safe, but some apps keep downloads (e.g. AI models) here.',
  },
  {
    id: 'temp', label: 'Temp folders', safe: false,
    names: ['temp', 'tmp'],
    hint: 'Close running apps first; files in use will be skipped.',
  },
  {
    id: 'git', label: 'Git history (.git)', safe: false,
    names: ['.git'],
    hint: 'Deleting this erases the repository history. Only if you really mean it!',
  },
];

function classify(name, siblings) {
  const lname = name.toLowerCase();
  for (const r of RULES) {
    if (r.names.includes(lname) && (!r.when || r.when(siblings))) return r;
  }
  return null;
}

const publicRules = RULES.map(({ id, label, safe, hint }) => ({ id, label, safe, hint }));

module.exports = { classify, publicRules };
