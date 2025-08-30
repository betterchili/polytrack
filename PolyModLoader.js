/**
 * Base class for all polytrack mods. Mods should export an instance of their mod class named `polyMod` in their main file.
 */
export class PolyMod {
    /**
     * The author of the mod.
     * 
     * @type {string}
     */
    get author() {
        return this.modAuthor;
    }
    /**
     * The mod ID.
     * 
     * @type {string}
     */
    get id() {
        return this.modID;
    }
    /**
     * The mod name.
     * 
     * @type {string}
     */
    get name() {
        return this.modName;
    }
    /**
     * The mod version.
     * 
     * @type {string}
     */
    get version() {
        return this.modVersion;
    }
    /**
     * The the mod's icon file URL.
     * 
     * @type {string}
     */
    get iconSrc() {
        return this.IconSrc;
    }
    set iconSrc(src) {
        this.IconSrc = src;
    }
    /**
     * The mod's loaded state.
     * 
     * @type {boolean}
     */
    get isLoaded() {
        return this.loaded;
    }
    set setLoaded(status) {
        this.loaded = status;
    }
    /**
     * The mod's base URL.
     * 
     * @type {string}
     */
    get baseUrl() {
        return this.modBaseUrl;
    }
    set baseUrl(url) {
        this.modBaseUrl = url;
    }
    /**
     * Whether the mod has changed the game physics in some way.
     *  
     * @type {boolean}
     */
    get touchesPhysics() {
        return this.touchingPhysics;
    }
    /**
     * Other mods that this mod depends on.
     */
    get dependencies() {
        return this.modDependencies;
    }
    get descriptionUrl() {
        return this.modDescription;
    }
    /**
     * Whether the mod is saved as to always fetch latest version (`true`)
     * or to fetch a specific version (`false`, with version defined by {@link PolyMod.version}).
     * 
     * @type {boolean}
     */
    get savedLatest() {
        return this.latestSaved;
    }
    set savedLatest(latest) {
        this.latestSaved = latest;
    }
    applyManifest = (manifest) => {
        const mod = manifest.polymod;
        /** @type {string} */
        this.modName = mod.name;
        /** @type {string} */
        this.modID = mod.id;
        /** @type {string} */
        this.modAuthor = mod.author;
        /** @type {string} */
        this.modVersion = mod.version;

        /** @type {string} */
        this.polyVersion = mod.targets;
        this.assetFolder = "assets";
        // no idea how to type annotate this
        // /** @type {{string: string}[]} */
        this.modDependencies = manifest.dependencies;
    }
    /**
     * Function to run during initialization of mods. Note that this is called *before* polytrack itself is loaded, 
     * but *after* everything has been declared.
     * 
     * @param {PolyModLoader} pmlInstance - The instance of {@link PolyModLoader}.
     */
    init = (pmlInstance) => { }
    /**
     * Function to run after all mods and polytrack have been initialized and loaded.
     */
    postInit = () => { }
    /**
     * Function to run before initialization of `simulation_worker.bundle.js`.
     */
    simInit = () => { }
    /**
     * Function that gets called *after* a mod dependency gets initialized.
     * @param {PolyMod} modDependency - The {@link PolyMod} instance of the dependency.
     */
    dependencyInit = function(modDependency) { }
}

/**
 * This class is used in {@link PolyModLoader}'s register mixin functions to set where functions should be injected into the target function.
 */
export const MixinType = Object.freeze({
    /**
     * Inject at the start of the target function.
     */
    HEAD: 0,
    /**
     * Inject at the end of the target function.
     */
    TAIL: 1,
    /**
     * Override the target function with the new function.
     */
    OVERRIDE: 2,
    /**
     * Insert code after a given token.
     */
    INSERT: 3,
})

export class PolyModLoader {
    constructor(polyVersion) {
        /** @type {string} */
        this.polyVersion = polyVersion;
        /** @type {PolyMod[]} */
        this.allMods = [];
        /** @type {boolean} */
        this.physicsTouched = false;
        /** 
         * @type {{
         *      scope: string,
         *      path: string,
         *      mixinType: MixinType,
         *      accessors: string[],
         *      funcString: string,
         *  }}
         */
        this.simWorkerClassMixins = [];
        /** 
         * @type {{
        *      path: string,
        *      mixinType: MixinType,
        *      accessors: string[],
        *      funcString: string,
        *  }}
        */
        this.simWorkerFuncMixins = [];
        this.modDependencies = {};
    }
    initStorage = (localStorage) => {
        /** @type {WindowLocalStorage} */
        this.localStorage = localStorage;
        /** @type {{base: string, version: string, loaded: bool}[]} */
        this.polyModUrls = this.getPolyModsStorage();
    }
    importMods = async () => {
        for (let polyModObject of this.polyModUrls) {
            let latest = false;
            if (polyModObject.version === "latest") {
                try {
                    const latestFile = await fetch(`${polyModObject.base}/latest.json`).then(r => r.json());
                    polyModObject.version = latestFile[this.polyVersion];
                    latest = true;
                } catch (err) {
                    alert(`Couldn't find latest version for ${polyModObject.base}`);
                    console.error("Error in fetching latest version json:", err);
                }
            }
            const polyModUrl = `${polyModObject.base}/${polyModObject.version}`;
            try {
                const manifestFile = await fetch(`${polyModUrl}/manifest.json`).then(r => r.json());
                let mod = manifestFile.polymod;
                try {
                    const modImport = await import(`${polyModUrl}/${mod.main}`);

                    let newMod = modImport.polyMod;
                    mod.version = polyModObject.version;
                    if (this.getMod(mod.id)) alert(`Duplicate mod detected: ${mod.name}`);
                    newMod.applyManifest(manifestFile);
                    newMod.baseUrl = polyModObject.base;
                    newMod.applyManifest = (nothing) => { console.warn("Can't apply manifest after initialization!") }
                    newMod.savedLatest = latest;
                    newMod.iconSrc = `${polyModUrl}/icon.png`;
                    if (polyModObject.loaded) {
                        newMod.setLoaded = true;
                        if (newMod.touchesPhysics) {
                            this.physicsTouched = true;
                            this.registerClassMixin("HB.prototype","submitLeaderboard", MixinType.OVERRIDE, [], (e, t, n, i, r, a) => {
                                console.log("nuh uh");
                            })
                        } 
                            
                        for(let dependency in newMod.dependencies) {
                            if(!this.modDependencies[`${dependency.id}-${dependency.version}`])
                                this.modDependencies[`${dependency.id}-${dependency.version}`] = [];
                            this.modDependencies[`${dependency.id}-${dependency.version}`].push(newMod.id);
                        }
                    }
                    this.allMods.push(newMod);
                } catch (err) {
                    alert(`Mod ${mod.name} failed to load.`);
                    console.error("Error in loading mod:", err);
                }
            } catch (err) {
                alert(`Couldn't load mod with URL ${polyModUrl}.`);
                console.error("Error in loading mod URL:", err);
            }
        }
    }
    getPolyModsStorage = () => {
        if (this.localStorage.getItem("polyMods")) {
            this.polyModUrls = JSON.parse(this.localStorage.getItem("polyMods"));
        } else {
            this.polyModUrls = [
                {
                    "base": "https://pml.orangy.cfd/0rangy/PolyModLoader/0.5.0/pmlcore",
                    "version": "latest",
                    "loaded": true
                }
            ];
            this.localStorage.setItem("polyMods", JSON.stringify(this.polyModUrls));
        }
        return this.polyModUrls;
    }
    serializeMod = (mod) => {
        return { "base": mod.baseUrl, "version": mod.savedLatest ? "latest" : mod.version, "loaded": mod.isLoaded };
    }
    saveModsToLocalStorage = () => {
        let savedMods = [];
        for (let mod of this.allMods) savedMods.push(this.serializeMod(mod));
        this.polyModUrls = savedMods;
        this.localStorage.setItem("polyMods", JSON.stringify(this.polyModUrls));
    }
    /**
     * Reorder a mod in the internal list to change its priority in mod loading.
     * 
     * @param {PolyMod} mod  - The mod to reorder.
     * @param {number} delta - The amount to reorder it by. Positive numbers decrease priority, negative numbers increase priority.
     */
    reorderMod = (mod, delta) => {
        if (!mod) return;
        const currentIndex = this.allMods.indexOf(mod);
        if ((currentIndex === 1) || delta > 0) return;
        if (currentIndex === null || currentIndex === undefined) {
            alert("This mod isn't loaded");
            return;
        }
        const temp = this.allMods[currentIndex + delta];
        this.allMods[currentIndex + delta] = this.allMods[currentIndex];
        this.allMods[currentIndex] = temp;
        this.saveModsToLocalStorage();
    }
    /**
     * Add a mod to the internal mod list. Added mod is given least priority.
     * 
     * @param {{base: string, version: string, loaded: bool}} polyModObject - The mod's JSON representation to add.
     */
    addMod = async (polyModObject, autoUpdate) => {
        let latest = false;
        if (polyModObject.version === "latest") {
            try {
                const latestFile = await fetch(`${polyModObject.base}/latest.json`).then(r => r.json());
                polyModObject.version = latestFile[this.polyVersion];
                if(autoUpdate){
                    latest = true;
                }
                latest = true;
            } catch {
                alert(`Couldn't find latest version for ${polyModObject.base}`);
            }
        }
        const polyModUrl = `${polyModObject.base}/${polyModObject.version}`;
        try {
            const manifestFile = await fetch(`${polyModUrl}/manifest.json`).then(r => r.json());
            const mod = manifestFile.polymod;
            if (this.getMod(mod.id)) {
                alert("This mod is already present!");
                return;
            }
            if (mod.targets.indexOf(this.polyVersion) === -1) {
                alert(
                    `Mod target version does not match polytrack version!
                    Note: ${mod.name} version ${PolyModObject.version} targets polytrack versions ${mod.targets.join(', ')}, but current polytrack version is ${this.polyVersion}.`
                );
                return;
            }
            try {
                const modImport = await import(`${polyModUrl}/${mod.main}`);
                let newMod = modImport.polyMod;
                newMod.iconSrc = `${polyModUrl}/icon.png`;
                mod.version = polyModObject.version;
                newMod.applyManifest(manifestFile);
                newMod.baseUrl = polyModObject.base;
                newMod.applyManifest = (nothing) => { console.warn("Can't apply manifest after initialization!") }
                newMod.savedLatest = latest;
                polyModObject.loaded = false;
                this.allMods.push(newMod);
                this.saveModsToLocalStorage();
            } catch (err) {
                alert("Something went wrong importing this mod!");
                console.error("Error in importing mod:", err);
                return;
            }
        } catch (err) {
            alert(`Couldn't find mod manifest for "${polyModObject.base}".`);
            console.error("Error in getting mod manifest:", err);
        }
    }
    /**
     * Remove a mod from the internal list.
     * 
     * @param {PolyMod} mod - The mod to remove.
     */
    removeMod = (mod) => {
        if (!mod) return;
        const index = this.allMods.indexOf(mod);
        if (index > -1) {
            this.allMods.splice(index, 1);
        }
        this.saveModsToLocalStorage();
    }
    /**
     * Set the loaded state of a mod.
     * 
     * @param {PolyMod} mod   - The mod to set the state of.
     * @param {boolean} state - The state to set. `true` is loaded, `false` is unloaded.
     */
    setModLoaded = (mod, state) => {
        if (!mod) return;
        mod.loaded = state;
        this.saveModsToLocalStorage();
    }
    initMods = () => {
        for (let polyMod of this.allMods) {
            if (polyMod.isLoaded) {
                polyMod.init(this);
                if(this.modDependencies[`${polyMod.id}-${polyMod.version}`]) {
                    for(let dependantId of this.modDependencies[`${polyMod.id}-${polyMod.version}`])
                        this.getMod(dependantId).dependencyInit(polyMod);
                }
            }
        }
    }
    postInitMods = () => {
        for (let polyMod of this.allMods) {
            if (polyMod.isLoaded) polyMod.postInit();
        }
    }
    simInitMods = () => {
        for (let polyMod of this.allMods) {
            if (polyMod.isLoaded) polyMod.simInit();
        }
    }
    /**
     * Access a mod by its mod ID.
     * 
     * @param   {string} id - The ID of the mod to get
     * @returns {PolyMod}   - The requested mod's object.
     */
    getMod(id) {
        if (id === "pmlcore") {
            return;
        }
        for (let polyMod of this.allMods) {
            if (polyMod.id == id) return polyMod;
        }
    }
    /**
     * Get the list of all mods.
     * 
     * @type {PolyMod[]}
     */
    getAllMods = function() {
        return this.allMods;
    }
    /**
     * Whether uploading runs to leaderboard is invalid or not.
     */
    get lbInvalid() {
        return this.physicsTouched;
    }
    getFromPolyTrack = (path) => { }
    /**
     * Inject mixin under scope {@link scope} with target function name defined by {@link path}.
     * This only injects functions in `main.bundle.js`.
     * 
     * @param {string} scope        - The scope under which mixin is injected.
     * @param {string} path         - The path under the {@link scope} which the mixin targets.
     * @param {MixinType} mixinType - The type of injection.
     * @param {string[]} accessors  - A list of strings to evaluate to access private variables.
     * @param {function} func       - The new function to be injected.
     */
    registerClassMixin = (scope, path, mixinType, accessors, func) => { }
    /**
     * Inject mixin with target function name defined by {@link path}.
     * This only injects functions in `main.bundle.js`.
     * 
     * @param {string} path         - The path of the function which the mixin targets.
     * @param {MixinType} mixinType - The type of injection.
     * @param {string[]} accessors  - A list of strings to evaluate to access private variables.
     * @param {function} func       - The new function to be injected.
     */
    registerFuncMixin = (path, mixinType, accessors, func) => { }
    /**
     * Inject mixin under scope {@link scope} with target function name defined by {@link path}.
     * This only injects functions in `simulation_worker.bundle.js`.
     * 
     * @param {string} scope        - The scope under which mixin is injected.
     * @param {string} path         - The path under the {@link scope} which the mixin targets.
     * @param {MixinType} mixinType - The type of injection.
     * @param {string[]} accessors  - A list of strings to evaluate to access private variables.
     * @param {function} func       - The new function to be injected.
     */
    registerSimWorkerClassMixin = (scope, path, mixinType, accessors, func) => {
        this.registerClassMixin("HB.prototype","submitLeaderboard", MixinType.OVERRIDE, [], (e, t, n, i, r, a) => {
            console.log("nuh uh");
        })
        this.simWorkerClassMixins.push({
            scope: scope,
            path: path,
            mixinType: mixinType,
            accessors: accessors,
            funcString: func.toString(),
        })
    }
    /**
     * Inject mixin with target function name defined by {@link path}.
     * This only injects functions in `simulation_worker.bundle.js`.
     * 
     * @param {string} path         - The path of the function which the mixin targets.
     * @param {MixinType} mixinType - The type of injection.
     * @param {string[]} accessors  - A list of strings to evaluate to access private variables.
     * @param {function} func       - The new function to be injected.
     */
    registerSimWorkerFuncMixin = (path, mixinType, accessors, func) => {
        this.registerClassMixin("HB.prototype","submitLeaderboard", MixinType.OVERRIDE, [], (e, t, n, i, r, a) => {
            console.log("nuh uh");
        })
        this.simWorkerFuncMixins.push({
            path: path,
            mixinType: mixinType,
            accessors: accessors,
            funcString: func.toString(),
        })
    }
}

let ActivePolyModLoader = new PolyModLoader("0.5.0");

export { ActivePolyModLoader }
