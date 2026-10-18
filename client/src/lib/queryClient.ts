import {QueryClient,QueryFunction} from "@tanstack/react-query";
declare global { interface Window { __API_BASE__?:string } }
const raw=window.__API_BASE__||"";
const local=["localhost","127.0.0.1","[::1]"].includes(location.hostname);
const API_BASE=raw.startsWith("__PORT_")?(local?"":"__UNRESOLVED__"):raw;
export async function apiRequest(method:string,url:string,data?:unknown):Promise<Response>{
 if(API_BASE==="__UNRESOLVED__")throw new Error("Backend connection was not configured. Please reopen the preview.");
 const res=await fetch(`${API_BASE}${url}`,{method,credentials:"same-origin",headers:data?{"Content-Type":"application/json"}:{},body:data?JSON.stringify(data):undefined});
 if(!res.ok){let message="Something went wrong. Please try again.";try{const body=await res.json();message=body.message||message}catch{}throw new Error(message)}
 return res;
}
export const queryClient=new QueryClient({defaultOptions:{queries:{queryFn:(async({queryKey})=>(await apiRequest("GET",queryKey.join("/"))).json()) as QueryFunction,refetchOnWindowFocus:false,staleTime:Infinity,retry:false},mutations:{retry:false}}});
