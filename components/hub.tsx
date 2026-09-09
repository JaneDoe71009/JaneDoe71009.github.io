'use client';
import { useEffect, useState } from 'react';
import { WorkspaceContent, pageTitles } from '@/components/workspace-content';
import { useHubData } from '@/lib/use-hub';
import Link from '@/components/site-link';
import { ArrowUpRight, BookOpen, CalendarDays, Clock3, GraduationCap, House, Library, Lightbulb, MessageCircle, Moon, Plus, Send, ShieldCheck, Sun, Users } from 'lucide-react';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
const navigation = [
  ['home', 'Overview', House], ['calendar', 'Calendar', CalendarDays], ['subjects', 'Subjects', BookOpen],
  ['ee', 'Extended essay', Library], ['tok', 'Theory of knowledge', Lightbulb], ['cas', 'Creativity, activity, service', Users],
  ['study-tips', 'Study tips', GraduationCap], ['resources', 'Resources', Library], ['forum', 'Forum', MessageCircle], ['submit', 'Submit', Send],
] as const;
export function Hub({ section }: { section: string }) {
  const state = useHubData();
  const [dark, setDark] = useState(false);
  useEffect(() => { const d = localStorage.getItem('ib-theme') === 'dark'; setDark(d); document.documentElement.classList.toggle('dark', d); }, []);
  function toggleTheme() { setDark(!dark); document.documentElement.classList.toggle('dark', !dark); localStorage.setItem('ib-theme', dark ? 'light' : 'dark'); }
  return <SidebarProvider style={{ '--sidebar-width': '15.5rem' } as React.CSSProperties}>
    <a className="skip-link" href="#main">Skip to content</a>
    <Sidebar className="app-sidebar">
      <SidebarHeader><Link href="/" className="brand"><span className="brand-mark">ib<span>•</span></span><span>IB Info<small>STUDENT HUB</small></span></Link></SidebarHeader>
      <SidebarContent><p className="nav-label">YOUR WORKSPACE</p><SidebarMenu>{navigation.map(([id, label, Icon]) => <SidebarMenuItem key={id}><SidebarMenuButton isActive={section === id} render={<Link href={id === 'home' ? '/' : `/${id}/`} />} className="nav-link"><Icon size={18}/><span>{label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu>{state.role !== 'student' && <Link href="/admin/" className="nav-link"><ShieldCheck size={17}/> Administration</Link>}<Link href="/privacy/" className="nav-link">Community & privacy</Link></SidebarContent>
      <SidebarFooter><div className="community-note"><span className="status-dot"/> Built for our IB community<small>Independent. Student-run. Shared.</small></div></SidebarFooter>
    </Sidebar>
    <SidebarInset className="app-main">
      <header className="topbar"><div className="topbar-left"><SidebarTrigger className="md:hidden"/><span>Workspace</span><span className="crumb">/</span><strong>{pageTitles[section] || 'Overview'}</strong></div><div className="topbar-actions"><button className="icon-button" onClick={toggleTheme} aria-label={dark ? 'Use light theme' : 'Use dark theme'}>{dark ? <Sun size={19}/> : <Moon size={19}/>}</button><Link href="/account/" className="button small">{state.user ? "Your account" : "Sign in"} <ArrowUpRight size={16}/></Link></div></header>
      <main id="main" className="page-content">
        <WorkspaceContent section={section} state={state}/>
        <footer className="page-footer">Student-run and independent of the IB and any school. Confirm official deadlines with your teacher or coordinator.</footer>
      </main>
    </SidebarInset>
  </SidebarProvider>;
}
