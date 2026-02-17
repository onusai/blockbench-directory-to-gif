
(function() {

    const fs = require('fs');
    const { Buffer } = require('buffer');

    var button;
    async function dataURLtoFile(dataurl, filename) {
        var arr = dataurl.split(","),
          mime = arr[0].match(/:(.*?);/)[1],
          bstr = atob(arr[arr.length - 1]),
          n = bstr.length,
          u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }

        const blob = new Blob([u8arr], { type: mime });
        const buffer = Buffer.from( await blob.arrayBuffer() );
        fs.writeFile(filename, buffer, () => {} );
      }

    async function selectAnimation(anim_uuid) {
        const anim_list = document.getElementById('animations_list');
        if (!anim_list) return false;
        
        const anim_item = anim_list.querySelector(`li[anim_id="${anim_uuid}"]`);
        if (anim_item) {
            anim_item.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
            return true;
        }
        return false;
    }

    async function recordModel(options, out_path, animation) {

        // Select animation if provided
        if (animation) {
            const selected = await selectAnimation(animation.uuid);
            if (!selected) {
                console.warn(`Could not select animation: ${animation.name}`);
                return false;
            }
            // Use animation length for recording
            if (options.length_mode === 'animation') {
                options.length = animation.length;
            }
        }
        main_preview.loadAnglePreset(DefaultCameraPresets[0])

        await new Promise((resolve) => setTimeout(resolve, 100));

        await fit_model(options.zoom_in, options.zoom_out);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        let gifDataPromise = new Promise((resolve, reject) => {
            Screencam.createGif(options , resolve)
        });

        const rec_btn = document.querySelector("#gif_recording_controls > div.tool.gif_record_button");
        rec_btn.click();

        let dataURL = await gifDataPromise;
        await dataURLtoFile(dataURL, out_path);
        return true;
    }

    function does_model_fit() {
        const raycaster = new THREE.Raycaster();
        let pointer = new THREE.Vector2();
    
        var objects = []
        Outliner.elements.forEach(element => {
            if (element.mesh && element.mesh.geometry && element.visibility) {
                objects.push(element.mesh);
            }
        })

        function is_object_hit(x, y) {
            pointer.x = ( x / Preview.selected.width ) * 2 - 1;
            pointer.y = - ( y / Preview.selected.height ) * 2 + 1;
            raycaster.setFromCamera(pointer, Preview.selected.camera)
            return raycaster.intersectObjects(objects).length > 0;
        }
    
        // check top and bottom pixels
        for (let y of [0, Preview.selected.height]) {
            for (let x = 0; x < Preview.selected.width; x++) {
                if (is_object_hit(x, y)) return false;
            }
        }
    
        // check left and right pixels
        for (let x of [0, Preview.selected.width]) {
            for (let y = 0; y < Preview.selected.height; y++) {
                if (is_object_hit(x, y)) return false;
            }
        }
    
        return true;
    } 

    async function fit_model(zoom_in, zoom_out) {
        let zoom_max = 1000;
        if (zoom_in) {
            for (let i = 0; i < zoom_max; i++) {
                if (!does_model_fit()) break;
                setZoomLevel('in');
                await new Promise((resolve) => setTimeout(resolve, 1));
            }
            setZoomLevel('out');
            setZoomLevel('out');
        }
        if (zoom_out) {
            for (let i = 0; i < zoom_max; i++) {
                if (does_model_fit()) break;
                setZoomLevel('out');
                await new Promise((resolve) => setTimeout(resolve, 1));
            }
        }
    }

    let dia = new Dialog({
            id: 'create_gif_batch',
            title: 'Directory to GIF',
            draggable: true,
            form: {
                // format: {label: 'dialog.create_gif.format', type: 'select', options: {
                //     gif: 'dialog.create_gif.format.gif',
                //     apng: 'APNG',
                //     png_sequence: 'dialog.create_gif.format.png_sequence',
                // }},
                input_dir:	{label: 'Input Directory', type: 'folder'},
                input_rec:	{label: 'Scan subdirectories', type: 'checkbox', value: false},
                '_0': '_',
                output_dir:	{label: 'Output Directory', type: 'folder'},
                output_struct:	{label: 'Reconstruct input folder structure', type: 'checkbox'},
                '_1': '_',
                length_mode: {label: 'dialog.create_gif.length_mode', type: 'select', default: 'seconds', options: {
                    seconds: 'dialog.create_gif.length_mode.seconds',
                    frames: 'dialog.create_gif.length_mode.frames',
                    animation: 'dialog.create_gif.length_mode.animation',
                    turntable: 'dialog.create_gif.length_mode.turntable',
                }},
                length:		{label: 'dialog.create_gif.length', type: 'number', value: 5, min: 0.1, step: 0.25, condition: (form) => ['seconds', 'frames'].includes(form.length_mode)},
                fps:		{label: 'dialog.create_gif.fps', type: 'number', value: 20, min: 0.5, max: 120},
                resolution:	{type: 'vector', label: 'dialog.advanced_screenshot.resolution', dimensions: 2, value: [500, 500], toggle_enabled: true, toggle_default: false},
                zoom:		{type: 'number', label: 'dialog.advanced_screenshot.zoom', value: 42, toggle_enabled: true, toggle_default: false},
                '_2': '_',
                pixelate:	{label: 'dialog.create_gif.pixelate', type: 'range', value: 1, min: 1, max: 8, step: 1},
                color:		{label: 'dialog.create_gif.color', type: 'color', value: '#00000000'},
                bg_image:	{label: 'dialog.create_gif.bg_image', type: 'file', extensions: ['png'], readtype: 'image', filetype: 'PNG'},
                turn:		{label: 'dialog.create_gif.turn', type: 'number', value: 0, min: -90, max: 90, description: 'dialog.create_gif.turn.desc'},
                '_3': '_',
                play:		{label: 'Record Animations', type: 'checkbox', value: false},
                anim_include:	{label: 'Include if name contains', type: 'text', placeholder: 'e.g. walk, run, idle', condition: (form) => form.play},
                anim_exclude:	{label: 'Exclude if name contains', type: 'text', placeholder: 'e.g. hurt, death', condition: (form) => form.play},
                anim_skip_existing:	{label: 'Skip if GIF already exists', type: 'checkbox', value: false, condition: (form) => form.play},
                '_4': '_',
                zoom_in:	{label: 'Zoom in to fit model', type: 'checkbox', value: true},
                zoom_out:	{label: 'Zoom out to fit model', type: 'checkbox', value: true},
            },
            onConfirm(formData) {
                let background = formData.color.toHex8String() != '#00000000' ? formData.color.toHexString() : undefined;
                this.hide();
                if (document.getElementById('gif_recording_frame')) {
                    document.getElementById('gif_recording_frame').remove();
                }
                button.beginRecord({
                    input_dir: formData.input_dir,
                    input_rec: formData.input_rec,
                    output_dir: formData.output_dir,
                    output_struct: formData.output_struct,
                    format: 'gif',//formData.format,
                    length_mode: formData.length_mode,
                    length: formData.length,
                    fps: formData.fps,
                    resolution: formData.resolution,
                    zoom: formData.zoom,
                    quality: formData.quality,
                    pixelate: formData.pixelate,
                    background,
                    background_image: formData.bg_image,
                    play: formData.play,
                    anim_include: formData.anim_include,
                    anim_exclude: formData.anim_exclude,
                    anim_skip_existing: formData.anim_skip_existing,
                    turnspeed: formData.turn,
                    zoom_in: formData.zoom_in,
                    zoom_out: formData.zoom_out
                })
            }
        })

    BBPlugin.register('directory_to_gif', {
        title: 'Directory to GIF',
        author: 'Onusai',
        icon: 'icon-saved',
        description: 'Create GIFs for all models in a directory',
        version: '1.0.0',
        variant: 'desktop',
        
        onload() {
            button = new Action('directory_to_gif', {
                name: 'Directory to GIF',
                description: 'Create GIFs for all models in a directory',
                icon: 'icon-saved',
                click: async function() {
                    dia.show();
                }
            });

            button.beginRecord = async function(options) {
                let inputDir = options.input_dir.replaceAll('\\', '/');
                let outputDir = options.output_dir.replaceAll('\\', '/');

                if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

                let files = [];

                const getFilesRecursively = (directory) => {
                    const filesInDirectory = fs.readdirSync(directory);
                    for (const file of filesInDirectory) {
                        const absolute = `${directory}/${file}`;
                        if (fs.statSync(absolute).isDirectory()) {
                            if (options.input_rec) getFilesRecursively(absolute);
                        } else {
                            if (absolute.endsWith(".bbmodel") || absolute.endsWith(".blockymodel")) {
                                files.push(absolute);
                            }
                        }
                    }
                };

                getFilesRecursively(inputDir);

                for (const path of files) {
                    let was_open = ModelProject.all.findIndex(project => project.save_path.replaceAll('\\', '/') == path || project.export_path.replaceAll('\\', '/') == path) !== -1;
                    Blockbench.read([path], {}, files => {
						loadModelFile(files[0]);
					})
                    await new Promise((resolve) => setTimeout(resolve, 500));

                    Modes.options.edit.select();
                    SharedActions.run('select_all');
                    Blockbench.dispatchEvent('select_all');
                    Modes.options.animate.select();
                    BarItems.focus_on_selection.trigger("click");

                    await new Promise((resolve) => setTimeout(resolve, 500));

                    let out_dir = outputDir;
                    if (options.output_struct) {
                        out_dir += path.slice(inputDir.length, path.length-1-`${Project.name}.bbmodel`.length)
                        if (!fs.existsSync(out_dir)) fs.mkdirSync(out_dir, { recursive: true });
                    }

                    if (options.play && Animator && Animator.animations && Animator.animations.length > 0) {
                        // Record each animation
                        // Parse comma-separated filters into arrays
                        const includeFilters = options.anim_include
                            ? options.anim_include.split(',').map(f => f.toLowerCase().trim()).filter(f => f.length > 0)
                            : [];
                        const excludeFilters = options.anim_exclude
                            ? options.anim_exclude.split(',').map(f => f.toLowerCase().trim()).filter(f => f.length > 0)
                            : [];
                        
                        for (const anim of Animator.animations) {
                            const animName = anim.name || 'unnamed';
                            const animNameLower = animName.toLowerCase();
                            
                            // Apply include filters - animation must match at least one include filter (if any are specified)
                            if (includeFilters.length > 0 && !includeFilters.some(filter => animNameLower.includes(filter))) {
                                continue;
                            }
                            
                            // Apply exclude filters - animation must not match any exclude filter
                            if (excludeFilters.length > 0 && excludeFilters.some(filter => animNameLower.includes(filter))) {
                                continue;
                            }

                            let out_path = `${out_dir}/${Project.name}_${animName}.gif`;

                            // Check if file exists and skip if requested
                            if (options.anim_skip_existing && fs.existsSync(out_path)) {
                                console.log(`Skipping ${out_path} - already exists`);
                                continue;
                            }

                            await recordModel(options, out_path, anim);
                        }
                    } else {
                        // Record without animation (static model)
                        let out_path = `${out_dir}/${Project.name}.gif`;
                        await recordModel(options, out_path, null);
                    }

                    if (!was_open) Project.close();
                }
            },
            MenuBar.addAction(button, 'filter');
            
        },
        onunload() {
            button.delete();
        }
    });

})();
