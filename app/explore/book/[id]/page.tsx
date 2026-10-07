import {PickDetail} from "@/components/editorial/PickDetail";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <PickDetail type="book" id={id}/>;}
