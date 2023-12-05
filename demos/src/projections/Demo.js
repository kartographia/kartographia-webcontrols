if(!kartographia) var kartographia={};
if(!kartographia.demo) kartographia.demo={};

kartographia.demo.Countries = function(parent, config) {
    var me = this;
    var map, countryLayer, gridLayer;
    var projectionList;
    var countryCopy;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){
        var table = createTable(parent);


      //Create toolbar
        createToolbar(table.addRow().addColumn());


      //Create map
        createMap(table.addRow().addColumn({
            height: "100%"
        }));


      //Populate the projectionList with map projections
        addProjections();


      //Set initial value
        projectionList.setValue("Mercator");

    };


  //**************************************************************************
  //** createToolbar
  //**************************************************************************
    var createToolbar = function(parent){


      //Create container
        var div = createElement("div", parent, {
            padding: "3px 10px"
        });
        var table = createTable(div);
        table.style.width = "";
        var tr = table.addRow();


      //Create projection dropdown/combobox
        tr.addColumn("form-label").innerText = "Select Projection:";
        projectionList = new javaxt.dhtml.ComboBox(tr.addColumn(), {
            style: javaxt.dhtml.style.default.combobox
        });



      //Watch for change events
        projectionList.onChange = function(label, value, orgLabel, orgVal){

          //Update map projection
            map.setProjection(value);

          //Update countries
            countryLayer.clear();
            countryLayer.getSource().addFeatures(getFeatures(map.getProjection()));

          //Update extents
            map.setExtent(countryLayer.getExtent());
        };
    };


  //**************************************************************************
  //** createMap
  //**************************************************************************
    var createMap = function(parent){

      //Instantiate map
        map = new kartographia.Map(parent, {
            basemap: null,
            zoom: 0,
            maxZoom: 5,
            partialZoom: true
        });


      //Add grid layer
        gridLayer = map.addLayer(new ol.layer.Graticule({
            targetSize: 30,
            strokeStyle: new ol.style.Stroke({
                color: 'rgba(222, 221, 224, 0.4)',
                width: 1
            })
        }));



      //Add country layer
        countryLayer = map.addLayer(new ol.layer.Vector({
            source: new ol.source.Vector({
                features: []
            }),
            style: new ol.style.Style({
                fill: new ol.style.Fill({
                    color: 'rgba(222, 221, 224, 1)' //#dedde0
                }),
                stroke: new ol.style.Stroke({
                    color: '#fff',
                    width: 1
                })
            })
        }));

    };


  //**************************************************************************
  //** addProjections
  //**************************************************************************
    var addProjections = function(){
        projectionList.add("Mercator", "EPSG:3857");
        projectionList.add("WGS84", "EPSG:4326");


      //Add custom projections
        var addProjection = function(name, code, defs, extent, worldExtent){
            map.addProjection(code, defs, extent, worldExtent);
            projectionList.add(name, code);
        };

        addProjection("Mollweide", "ESRI:54009",
        '+proj=moll +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 units=m +no_defs',
        [-18019909.21177587, -9009954.605703328, 18019909.21177587, 9009954.605703328],
        [-179.99, -89.99, 179.99, 89]);


        addProjection("Albers", 'ESRI:102008',
        '+proj=aea +lat_1=20 +lat_2=60 +lat_0=40 +lon_0=-96 +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs',
        [-18019909.21177587, -9009954.605703328, 18019909.21177587, 9009954.605703328],
        [-179.99, -89.99, 179.99, 89],
        //[-130, 15, -60, 75]
        );
    };


  //**************************************************************************
  //** getFeatures
  //**************************************************************************
    var getFeatures = function(projection){

      //Get map data
        if (!countryCopy) countryCopy = JSON.stringify(kartographia.data.countries);
        var data = JSON.parse(countryCopy);


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

          //Remove Antarctica as needed
            if (countryName==="Antarctica"){
                var code = projection.getCode();
                if (code==="EPSG:3857" || code==="ESRI:102008") return;
            }


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


      //Convert the WGS84 poygons to the given map projection
        arr.forEach((f)=>f.getGeometry().transform('EPSG:4326', projection));


        return arr;
    };




  //**************************************************************************
  //** Utils
  //**************************************************************************
    var createTable = javaxt.dhtml.utils.createTable;
    var createElement = javaxt.dhtml.utils.createElement;


    init();
};