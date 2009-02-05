

/**
 * class JWPlayer
 *
 * A convenince class that wraps JW FLV Media Player 4.x, handling loading and configuration
 * of the player as well as providing simple object-orientated JavaScript interface to it.
 * 
 * Event handling is done Prototype-style, via JWPlayer#observe. 
 *
 * Sending commands to the player (view events, in the player's own terms) is done by using
 * the appropriate instance methods, e.g. play(), pause() and setFullscreen(), instead
 * of calling sendEvent directly.
 *
 * The class takes care not to do too much. For one thing, it let's through unknown 
 * configuration variables, treating them as flashvars for the player. Another example
 * are the JWPlayer#getPlaylist() and JWPlayer#getConfig() methods which are just simple
 * wrappers for the respective methods of the SWF player itself.
 **/
var JWPlayer = Class.create({
	
	/**
	 * new JWPlayer(container, options) -> JWPlayer
	 * - container (String): ID of the DOM element which the player should replace
	 * - options (Object): 
	 *      file = null                 The file to load at startup. See also JWPlayer#load(object)
	 *      width                       Width in pixels
	 *      height                      Height in pixels
	 *      version = '8'               Minimum version of Flash-runtime required
	 *      playerSwf = JWPlayer.SWF    Location of the player's SWF file
	 *      loadPlayer = true   Wether JWPlayer#loadPlayer() will be called when created
	 *
	 * Creates a new instance of JWPlayer.
	 *
	 * Other options specified are given to the Flash-player as flashvars. See
	 * http://developer.longtailvideo.com/trac/wiki/FlashVars for complete list of
	 * available flashvars.
	 **/
	initialize: function(container, options) {
		this.options = $H({
		    file: null,
			version: '8',
			loadPlayer: true,
			playerSwf: JWPlayer.SWF
		}).merge(options);
		
		['width', 'height'].each(function(option) {
		    if (!this.options.get(option))
		        throw "JWPlayer#initialize: Required option " + option + " missing";
		}, this);
		
		this.state = null;
		
		this.ready = false;
		this.readyQueue = [];
		
		this.id = '_jwplayer_' + JWPlayer._id_sequence++;
		JWPlayer._instances[this.id] = this;
				
		this.container = container;
		this.player = null; // Will reference the actual player object, after it has been loaded
		
		if (this.options.get('loadPlayer'))
		    this.loadPlayer();
		    
		this.observe('model:state', this.stateListener.bind(this));
	},
	

  
	stateListener: function(event) {
	    this.state = event.newstate;
	},
	
	
	/**
	 * JWPlayer#loadPlayer()
	 *
	 * Loads the player's SWF file into the DOM.
	 **/
	loadPlayer: function() {
	    if (this.container instanceof Element) {
	        this.container.id = this.id;
	        this.container = this.id;
	    } 
	    
		var flashvars = this.options.clone();
		// Remove options that are not flashvars:
		['width', 'height', 'version', 'loadPlayer', 'playerSwf'].each(flashvars.unset, flashvars);
				
		swfobject.embedSWF(this.options.get('playerSwf'),
				this.container,
				this.options.get('width'),
				this.options.get('height'),
				this.options.get('version'),
				null,
				flashvars.toObject(),
				{ allowscriptaccess: 'always', allowfullscreen: true },
				{ name: this.id, id: this.id }
			);
	},
	
	
	/* Add functions and their arguments to an internal queue. They will be 
	 * run when the player is ready (see JWPlayer#_setPlayer)
	 */
	addToReadyQueue: function(func, args) {
	    if (this.ready)
	        func.apply(this, args);
	    this.readyQueue.push([func, args]);
	},
	
	
	/**
	 * JWPlayer#observe(eventName, callback) -> String
	 * - eventName (String): Name of the event, of the form "namespace:event"
	 * - callback (Function | String): The callback function. Can also be specified as the name of a global function.
	 *
	 * Adds an observer for a player event. The available namespaces correspond to
	 * the three different types of events: `model', `controller' and `view'.
	 * See http://developer.longtailvideo.com/trac/wiki/FlashEvents for the
	 * complete list of available events.
	 *
	 * Note: JWPlayer JavaScript event handling is quite primitive. Perhaps the most 
     * annoying quirk is that it's event adding functions only accept names of global 
	 * functions. This method takes care of that, but for convenience it returns the
	 * name of the global function created. That name can then be used again, by giving it
	 * to observe as the callback function.
	 * 
	 * There is (to my knowledge) no way of deregistering observers, which could 
	 * potentially lead to memorey leaks.
	 **/
	observe: function(eventName, callback) {
	    if (!this.ready) {
	        this.addToReadyQueue(arguments.callee, arguments);
	        return;
	    }
	    	    
	    var parts = eventName.toUpperCase().split(':');
	    var namespace = parts[0];
	    var name = parts[1];

	    var eventList = JWPlayer[namespace.toUpperCase() + '_EVENTS'];
	    if (!eventList || !eventList[name])
	        throw "JWPlayer#observe: Unknown event `" + eventName + "'";
	        
	    var callback_name;
	    if (typeof callback == 'function') {
    	    // Store the callback in the global namespace (Yes I know, horribly ugly, but
    	    // that's what JWPlayer wants!)
	        callback_name = this.id + '_callback_' + JWPlayer._callback_id_sequence++;
	        window[callback_name] = callback;
	    } else
	        callback_name = callback;
	    
	    this.player[JWPlayer._event_registrers[namespace]](name, callback_name);
	    
	    return callback_name;
	},
	

	/**
	 * JWPlayer#getPlaylist() -> Array
	 **/	
	getPlaylist: function() {
	    if (!this.player)
	        return [];
	    else
	        return this.getPlaylist();
	},
	
	
	/**
	 * JWPlayer#getConfig() -> Object
	 **/
	getConfig: function() {
	    if (!this.player)
	        return {};
	    else
	        return this.getConfig();
	},


  /**
   * JWPlayer#getState() -> String
   *
   *  Returns the current state of the player
   **/
  getState: function() {
    return this.state;
  },
	
	
	/**
	 * JWPlayer#setFullscreen(state)
	 **/
	setFullscreen: function(state) {
		this.sendEvent('FULLSCREEN', state)
	},
	

	/**
	 * JWPlayer#setItem(index)
	 *
	 * Move to the playlist item indexed by `index'.
	 **/
	setItem: function(index) {
		this.sendEvent('ITEM', index);
	},
	
	/**
	 * JWPlayer#setMute(state)
	 **/
	setMute: function(state) {
		this.sendEvent('MUTE', state);
	},
	
	
	/**
	 * jwplayer.load(object)
	 *
	 * Loads a new item for playback. `object' can be an URL to a video file or a playlist,
	 * or a playlist item as an object, or an array of playlist items.
	 *
	 * A playlist item is an object of the form
	 *      {file: "http://www.myserver.com/myvideo.flv", title: "My Cool Video"}
	 **/
	load: function(object) {
		this.sendEvent('LOAD', object);
	},
	
	/**
	 * JWPlayer#nextItem()
	 *
	 * Moves to the next item in the playlist, if any.
	 **/
	nextItem: function() {
		this.sendEvent('NEXT')
	},
	
	/**
	 * JWPlayer#previousItem()
	 *
	 * Moves to the previous item in the playlist, if any.
	 **/
	previousItem: function() {
		this.sendEvent('PREV')
	},
	
	/**
	 * JWPlayer#play()
	 **/
	play: function() {
	    this.sendEvent('PLAY', 1);
	},
	
	/**
	 * JWPlayer#setPlaying(playing)
	 *
	 * Toggle between play and pause.
	 **/
	setPlaying: function(playing) {
	    this.sendEvent('PLAY', playing ? 1 : 2)
	},
	
	/**
	 * JWPlayer#pause()
	 **/
	pause: function() {
	    this.sendEvent('PLAY', 2);
	},
	
	playPause: function() {
	    this.sendEvent('PLAY', this.state == 'PLAYING' ? 2 : 1)
	},
	
	/**
	 * JWPlayer#setSmoothPlayback(state)
	 **/
	setSmoothPlayback: function(state) {
		this.sendEvent('QUALITY', state)
	},
	
	/**
	 * JWPlayer#redraw()
	 **/
	redraw: function() {
		this.sendEvent('REDRAW')
	},
	
	/**
	 * JWPlayer#skip(seconds)
	 **/
	skip: function(seconds) {
		this.sendEvent('SKIP', seconds);
	},
	
	/**
	 * JWPlayer#stop()
	 **/
	stop: function() {
		this.sendEvent('STOP')
	},
	
	/**
	 * JWPlayer#setVolume(percentage)
	 *
	 * Sets the volume to `percentage', a number between 0 and 100.
	 **/
	setVolume: function(percentage) {
	    this.sendEvent('VOLUME', percentage)
	},
	
	
	/**
	 * JWPlayer#sendEvent(eventName[, arg1 [, arg2 [, ...]]])
	 *
	 * Sends a command to the player (or in the words of the playr
     * itself, send `an event').
	 */
	sendEvent: function(eventName) {
	    if (!this.ready) {
	        this.addToReadyQueue(arguments.callee, arguments);
	        return;
	    }
	     
	    var args = $A(arguments).collect(function(item) {
	        return item ? item.toString() : null;
	    });
	    this.player.sendEvent.apply(this.player, args);
	},
	

    /* Called from playerReady to link the actual player to an instance
     * of JWPlayer
     */
	_setPlayer: function(player) {
	    if (!player)
	        throw "JWPlayer#_setPlayer called without a valid player";
	
	    this.player = player;
	    this.ready = true;
	    
	    this.readyQueue.each(function(q) {
	        q[0].apply(this, q[1]);
	    }, this);
	    this.readyQueue = [];
	},
	
	toString: function() {
	    return "JWPlayer[" + this.id + "]";
	}
	
	
});

JWPlayer._instances = {}
JWPlayer._id_sequence = 0;

JWPlayer._callback_id_sequence = 0;

JWPlayer.VIEW_EVENTS = 'FULLSCREEN LINK LOAD MUTE NEXT ITEM PLAY PREV REDRAW SEEK STOP TRACE VOLUME';
JWPlayer.MODEL_EVENTS = 'BUFFER ERROR LOADED META STATE TIME';
JWPlayer.CONTROLLER_EVENTS = 'ERROR ITEM PLAY PLAYLIST RESIZE SEEK STOP VOLUME';

JWPlayer._event_registrers = {
    'MODEL': 'addModelListener',
    'CONTROLLER': 'addControllerListener',
    'VIEW': 'addViewListener'
};

'VIEW_EVENTS MODEL_EVENTS CONTROLLER_EVENTS'.split(' ').each(function(type) {
    var h = {};
    JWPlayer[type].split(' ').each(function(eventName) {
        h[eventName] = true;
    });
    JWPlayer[type] = h;
});


/**
 * JWPlayer.SWF = 'jwplayer/player.swf'
 *
 * Default location of the player's SWF file
 **/
JWPlayer.SWF = 'jwplayer/player.swf';



/**
 * playerReady(obj)
 *
 * Called by the Flash-object when the player has loaded and is ready for use. 
 **/
function playerReady(obj) {
	var instance = JWPlayer._instances[obj.id];
	if (!instance)
		throw "Missing JWPlayer instance `" + obj.id + "' in playerReady()";
	else
		instance._setPlayer($(obj.id))
}
