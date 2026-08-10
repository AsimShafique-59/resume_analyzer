function ChipList({ items }) {
  if (!items || !items.length) return <span className="v">—</span>
  return (
    <div className="chips">
      {items.map((item) => (
        <span className="chip" key={item}>
          {item}
        </span>
      ))}
    </div>
  )
}

export default function ProfileGrid({ profile }) {
  return (
    <div className="profile-grid">
      <div>
        <div className="k">Name</div>
        <div className="v">{profile.name || '—'}</div>
      </div>
      <div>
        <div className="k">Email</div>
        <div className="v">{profile.email || '—'}</div>
      </div>
      <div>
        <div className="k">Phone</div>
        <div className="v">{profile.phone || '—'}</div>
      </div>
      <div>
        <div className="k">Skills</div>
        <ChipList items={profile.skills} />
      </div>
      <div>
        <div className="k">Education</div>
        <ChipList items={profile.education} />
      </div>
      <div>
        <div className="k">Experience</div>
        <ChipList items={profile.experience} />
      </div>
    </div>
  )
}
