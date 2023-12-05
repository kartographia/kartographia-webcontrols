if(!kartographia) var kartographia={};
if(!kartographia.demo) kartographia.demo={};

kartographia.demo.Countries = function(parent, config) {
    var me = this;
    var tooltip;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){


      //Instantiate map
        var map = new kartographia.Map(parent, {
            basemap: null,
            zoom: 0,
            maxZoom: 5,
            partialZoom: true
        });



      //Set style for the country polygons
        var style = new ol.style.Style({
            fill: new ol.style.Fill({
                color: 'rgba(222, 221, 224, 1)' //#dedde0
            }),
            stroke: new ol.style.Stroke({
                color: '#fff',
                width: 1
            })
        });


      //Create layer
        var layer = map.addLayer(new ol.layer.Vector({
            source: new ol.source.Vector({
                features: getFeatures()
                //overlaps: false
            }),
            style: style
        }));



        map.setExtent(layer.getExtent());



      //Watch for mouse-over events
        var currSelection = null;
        var selectedStyle = style.clone();
        selectedStyle.getFill().setColor('rgba(222, 221, 224, 0.6)');
        map.onMouseMove = function(lat, lon, e){

          //Get selected feature
            var selectedFeature = null;
            map.getMap().forEachFeatureAtPixel(e.pixel, function (f) {
                selectedFeature = f;
                return true;
            });


          //Show tooltop
            if (selectedFeature){
                if (!tooltip) createTooltip();
                tooltip.style.top = (e.clientY) + "px";
                tooltip.style.left = (e.clientX + 20) + "px";
                tooltip.innerHTML = selectedFeature.get('name');
                tooltip.show();
            }
            else{
                if (tooltip) tooltip.hide();
            }


          //Update fill of the previously selected feature as needed
            if (currSelection){
                if (selectedFeature && selectedFeature.getId()===currSelection.getId()){
                    //return;
                }
                currSelection.setStyle(style);
            }


          //Update fill for the selected feature
            if (selectedFeature){
                currSelection = selectedFeature;
                currSelection.setStyle(selectedStyle);
            }
        };
    };


  //**************************************************************************
  //** getFeatures
  //**************************************************************************
    var getFeatures = function(){

      //Get map data
        var data = kartographia.data.countries;


      //Instantiate TopoJSON with a layer filter
        var topoJson = new ol.format.TopoJSON({
            layers: ["countries"]
        });


      //Read features
        var features = topoJson.readFeaturesFromObject(data);


      //Update features array
        var arr = [];
        features.forEach((feature)=>{
            var countryName = feature.get('name');

          //Remove Antarctica
            if (countryName==="Antarctica") return;


          //Fix coordinates that cross back/forth over 180 longitude
            if (countryName==="Fiji" || countryName==="Russian Federation"){
                var geom = feature.getGeometry();
                var coords = geom.flatCoordinates;

                for (var i=0; i<coords.length; i++){
                    var lon = coords[i];
                    //var lat = coords[i+1];

                    if (lon<0){
                        var offset = 180+lon;
                        coords[i] = 180 + offset;
                    }

                    i++;
                }
            }

            arr.push(feature);
        });


      //Convert the WGS84 poygons to EPSG:3857
        arr.forEach((f)=>f.getGeometry().transform('EPSG:4326', 'EPSG:3857'));

        return arr;
    };


  //**************************************************************************
  //** createTooltip
  //**************************************************************************
    var createTooltip = function(){

        var getHighestElements = javaxt.dhtml.utils.getHighestElements;
        if (!tooltip){
            tooltip = createElement("div", document.body, "tooltip noselect");
            tooltip.style.position = "absolute";
            tooltip.style.opacity = 0;
            tooltip.style.top = 0;
            tooltip.style.left = 0;
            tooltip.style.display = "none";

            tooltip.show = function(){
                if (tooltip.style.opacity===1) return;

              //Get zIndex
                var highestElements = getHighestElements();
                var zIndex = highestElements.zIndex;
                if (!highestElements.contains(tooltip)) zIndex++;

              //Update tooltip
                tooltip.style.opacity = 1;
                tooltip.style.display = "block";
                tooltip.style.zIndex = zIndex;
            };

            tooltip.hide = function(){
                tooltip.style.opacity = 0;
                tooltip.style.display = "none";
            };

            tooltip.onmouseover = function(){
                tooltip.hide();
            };
        }
        return tooltip;
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var createElement = javaxt.dhtml.utils.createElement;


    init();
};