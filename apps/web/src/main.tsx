import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import './styles.css';
class ErrorBoundary extends React.Component<{children:React.ReactNode},{error:string}> {
  state={error:''};
  static getDerivedStateFromError(error:Error){return{error:error.message};}
  render(){return this.state.error?<main className="fatal"><h1>观察台暂时遇到问题</h1><p>{this.state.error}</p><p>已有存档仍保存在当前浏览器。</p><button onClick={()=>location.reload()}>重新打开</button></main>:this.props.children;}
}
createRoot(document.getElementById('root')!).render(<ErrorBoundary><App/></ErrorBoundary>);

if(import.meta.env.PROD&&'serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    void navigator.serviceWorker.register(new URL('./sw.js',document.baseURI)).catch(error=>console.warn('离线缓存注册失败',error));
  },{once:true});
}
