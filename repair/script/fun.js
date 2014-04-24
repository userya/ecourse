//--
var imgScrollNum2=new Array();
for(i=0;i<50;i++){
  imgScrollNum2[i]=0;	
}
function imgScrollRight2(a,b,c,d){
	    //a.stop();
		if(imgScrollNum2[d]<b){
			imgScrollNum2[d]++;
			a.animate({scrollLeft: imgScrollNum2[d]*c}, 200);
			}
	}	
function imgScrollLeft2(a,b,c,d){
	    //a.stop();
		if(imgScrollNum2[d]>0){
			imgScrollNum2[d]--;
			a.animate({scrollLeft: imgScrollNum2[d]*c}, 200);		
			}
	}	