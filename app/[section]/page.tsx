import { Hub } from '@/components/hub';
export const dynamicParams=false;
export function generateStaticParams(){return ['calendar','subjects','ee','tok','cas','study-tips','resources','forum','submit','account','admin','privacy'].map(section=>({section}));}
export default async function Section({params}:{params:Promise<{section:string}>}){const {section}=await params;return <Hub section={section}/>;}
