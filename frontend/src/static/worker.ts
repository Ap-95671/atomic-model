/// <reference lib="webworker" />
import referenceUrl from '../../static-data/reference.json?url';
import {calculate} from './router';
const scope=self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage=async event=>{
 try{
  const response=await fetch(referenceUrl);if(!response.ok)throw new Error('Bundled scientific reference data failed to load.');
  const reference=await response.json();scope.postMessage({result:calculate(String(event.data),reference)});
 }catch(error){scope.postMessage({error:(error as Error).message});}
};
