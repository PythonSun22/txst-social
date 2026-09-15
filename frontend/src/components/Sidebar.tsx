import Link from "next/link";

const Sidebar = () => {
  return (
    <div className="sidebar">
        <h2>Sidebar</h2>
        <ul>
            <li><Link href="/">ForAll</Link></li>
            <li><Link href="/colleges">Colleges</Link></li>
            <li><Link href="/profile">Profile</Link></li>
        </ul>
    </div>
  );
}

export default Sidebar;