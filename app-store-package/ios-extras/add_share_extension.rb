# Adds the 21again Share Extension target to the Capacitor-generated Xcode project.
# Run from app-store-package/ after `npx cap sync ios`:  ruby ios-extras/add_share_extension.rb
# Idempotent: re-running on a project that already has the target is a no-op.
require 'xcodeproj'
require 'fileutils'

proj_path = 'ios/App/App.xcodeproj'
proj = Xcodeproj::Project.open(proj_path)
app = proj.targets.find { |t| t.name == 'App' } or abort('ERROR: target "App" not found')
if proj.targets.any? { |t| t.name == 'ShareExtension' }
  puts 'ShareExtension target already present'
  exit 0
end

# 1. copy the sources next to the app target
FileUtils.mkdir_p('ios/App/ShareExtension')
FileUtils.cp('ios-extras/ShareExtension/ShareViewController.swift', 'ios/App/ShareExtension/ShareViewController.swift')
FileUtils.cp('ios-extras/ShareExtension/Info.plist', 'ios/App/ShareExtension/Info.plist')

# 2. the target
ext = proj.new_target(:app_extension, 'ShareExtension', :ios, '14.0')
group = proj.main_group.find_subpath('ShareExtension', true)
group.set_source_tree('SOURCE_ROOT')
group.set_path('ShareExtension')
src = group.new_file('ShareViewController.swift')
group.new_file('Info.plist')
ext.add_file_references([src])

app_cfg = app.build_configurations.first.build_settings
ext.build_configurations.each do |c|
  bs = c.build_settings
  bs['INFOPLIST_FILE'] = 'ShareExtension/Info.plist'
  bs['GENERATE_INFOPLIST_FILE'] = 'NO'
  bs['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.recisource.app.share'
  bs['PRODUCT_NAME'] = '$(TARGET_NAME)'
  bs['SWIFT_VERSION'] = '5.0'
  bs['IPHONEOS_DEPLOYMENT_TARGET'] = '14.0'
  bs['TARGETED_DEVICE_FAMILY'] = '1,2'
  bs['SKIP_INSTALL'] = 'YES'
  bs['CODE_SIGN_STYLE'] = app_cfg['CODE_SIGN_STYLE'] || 'Automatic'
  bs['DEVELOPMENT_TEAM'] = app_cfg['DEVELOPMENT_TEAM'] if app_cfg['DEVELOPMENT_TEAM']
  bs['MARKETING_VERSION'] = app_cfg['MARKETING_VERSION'] if app_cfg['MARKETING_VERSION']
  bs['CURRENT_PROJECT_VERSION'] = app_cfg['CURRENT_PROJECT_VERSION'] if app_cfg['CURRENT_PROJECT_VERSION']
  bs['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
  bs['APPLICATION_EXTENSION_API_ONLY'] = 'YES'
end

# 3. build it before the app and embed it in the app bundle (PlugIns/)
app.add_dependency(ext)
embed = app.new_copy_files_build_phase('Embed App Extensions')
embed.symbol_dst_subfolder_spec = :plug_ins
bf = embed.add_file_reference(ext.product_reference)
bf.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

proj.save
puts 'ShareExtension target added and embedded in App'
