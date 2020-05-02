if(!com) var com={};
if(!com.kartographia) com.kartographia={};

//******************************************************************************
//**  MapMenu
//******************************************************************************
/**
 *   Used to generate a list of map layers
 *
 ******************************************************************************/

com.kartographia.MapMenu = function(parent, config) {

    var me = this;
    var defaultConfig = {
        style: {
            thumbnail: "map-tile",
            label: "map-tile-label map-info"
        },
        layers: {}
    };

    var menu;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){


        if (typeof parent === "string"){
            parent = document.getElementById(parent);
        }
        if (!parent) return;


      //Clone the config so we don't modify the original config object
        var clone = {};
        merge(clone, config);


      //Merge clone with default config
        merge(clone, defaultConfig);
        config = clone;



        menu = document.createElement("div");
        parent.appendChild(menu);
        me.update();
        me.el = menu;
    };


  //**************************************************************************
  //** show
  //**************************************************************************
    this.show = function(){
        me.el.style.display = '';
    };


  //**************************************************************************
  //** hide
  //**************************************************************************
    this.hide = function(){
        me.el.style.display = 'none';
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){
        for (var key in config.layers) {
            if (config.layers.hasOwnProperty(key)){
                var layer = config.layers[key];
                var div = layer.div;
                if (!div){
                    layer.div = createThumbnail(layer);
                }
            }
        }
    };


  //**************************************************************************
  //** onSelect
  //**************************************************************************
    this.onSelect = function(layer){};


  //**************************************************************************
  //** createThumbnail
  //**************************************************************************
    var createThumbnail = function(layer){

        var div = document.createElement("div");
        setStyle(div, config.style.thumbnail);
        menu.appendChild(div);

        var label = document.createElement("div");
        setStyle(label, config.style.label);
        label.style.zIndex = 1;
        label.innerHTML = layer.name;
        div.appendChild(label);

        var preview = document.createElement("div");
        preview.style.position = "absolute";
        div.appendChild(preview);

        var img = document.createElement("img");
        img.src = layer.preview;
        preview.appendChild(img);


        div.onclick = function(){
            me.onSelect(layer);
        };

        return div;
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var setStyle = javaxt.dhtml.utils.setStyle;
    var createTable = javaxt.dhtml.utils.createTable;


    init();

};