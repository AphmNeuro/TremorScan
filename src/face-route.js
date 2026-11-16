// The face page has a single purpose; navigation is provided by the three tabs.
const face=document.getElementById('mode-face');
if(face){
 face.click();
 const choice=face.closest('.mode-choice');
 if(choice){choice.hidden=true;choice.setAttribute('aria-hidden','true');}
 const hand=document.getElementById('mode-hand');
 if(hand){hand.onclick=null;hand.tabIndex=-1;}
 face.onclick=null;face.tabIndex=-1;
}
